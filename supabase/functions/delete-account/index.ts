// @ts-nocheck

import { createClient } from 'npm:@supabase/supabase-js@2';
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app';
import { getAuth } from 'npm:firebase-admin/auth';
import { getFirestore, FieldValue } from 'npm:firebase-admin/firestore';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function getPrivateKey() {
  // Preferred: base64-encoded secret, immune to shell/CLI newline mangling.
  const b64 = Deno.env.get('FIREBASE_PRIVATE_KEY_B64');
  if (b64) {
    try {
      return atob(b64.trim());
    } catch {
      // fall through to legacy handling below
    }
  }

  // Legacy fallback: plain FIREBASE_PRIVATE_KEY secret.
  let key = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';
  key = key.trim().replace(/^"(.*)"$/s, '$1');
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  return key;
}

let initError = null;
let db = null;

try {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: Deno.env.get('FIREBASE_PROJECT_ID'),
        clientEmail: Deno.env.get('FIREBASE_CLIENT_EMAIL'),
        privateKey: getPrivateKey()
      })
    });
  }

  db = getFirestore();
  // The Firestore Admin client defaults to gRPC, which cannot open a raw
  // TCP/HTTP2 socket inside Supabase's Deno Edge Runtime and fails with
  // "Client network socket disconnected before secure TLS connection was
  // established." Forcing REST transport fixes it. Must be set exactly once,
  // before any Firestore call, hence it lives here at module scope.
  db.settings({ preferRest: true });
} catch (e) {
  initError = e instanceof Error ? e.message : String(e);
  console.error('Firebase admin init failed:', initError);
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function serialToNumber(serial) {
  if (!serial) return null;
  const n = parseInt(String(serial).replace(/\D/g, ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    // 204 responses MUST have a null body — a string body here throws
    // "Response with null body status cannot have body" and kills the
    // preflight, which the browser then reports as a CORS failure.
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (initError) {
    return new Response(
      JSON.stringify({ success: false, error: `Server misconfigured: ${initError}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing authorization token');

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const shopRef = db.collection('shops').doc(uid);
    const shopSnap = await shopRef.get();
    const firestoreSerial = shopSnap.exists ? shopSnap.data()?.serialNumber : null;

    // Fallback to Supabase's copy of the serial in case Firestore doc is already gone
    const { data: supaShop, error: shopFindError } = await supabase
      .from('shops')
      .select('serial_number')
      .eq('firebase_uid', uid)
      .maybeSingle();

    if (shopFindError) throw shopFindError;

    const serialNumber = firestoreSerial || supaShop?.serial_number || null;
    const serialNum = serialToNumber(serialNumber);

    // 1. Delete Firestore shop doc + release serial number in the SAME transaction,
    //    since this is the counter Signup.jsx actually reads for allocation.
    if (shopSnap.exists || serialNum) {
      await db.runTransaction(async tx => {
        const counterRef = db.collection('system').doc('shopCounter');
        const counterSnap = await tx.get(counterRef);
        const data = counterSnap.exists ? counterSnap.data() : {};

        const free = Array.isArray(data?.availableSerialNumbers)
          ? data.availableSerialNumbers.map(Number).filter(n => Number.isInteger(n) && n > 0)
          : [];

        if (serialNum && !free.includes(serialNum)) free.push(serialNum);
        free.sort((a, b) => a - b);

        tx.set(counterRef, {
          activeCount: Math.max(0, Number(data?.activeCount || 1) - 1),
          availableSerialNumbers: free,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        if (shopSnap.exists) tx.delete(shopRef);
      });
    }

    // 2. Delete Supabase shop row (related tables cascade if FKs are set up that way)
    const { error: shopError } = await supabase
      .from('shops')
      .delete()
      .eq('firebase_uid', uid);

    if (shopError) throw shopError;

    // 3. Delete Firebase Auth user LAST — irreversible, do it once everything else succeeded
    await getAuth().deleteUser(uid);

    return new Response(
      JSON.stringify({ success: true, serialNumber }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Account deletion failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});