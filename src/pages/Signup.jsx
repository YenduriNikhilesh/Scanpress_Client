import {useState} from 'react';
import {createClient} from 'https://esm.sh/@supabase/supabase-js';
import {Eye,EyeOff} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {createUserWithEmailAndPassword,deleteUser} from 'firebase/auth';
import {doc,runTransaction,serverTimestamp,deleteDoc} from 'firebase/firestore';
import {auth,db} from '../services/firebase';
import {useApp} from '../services/AppContext';
import '../styles/auth.css';

const supabase=createClient(
  'https://eacrbqwxcczaakpuvgrp.supabase.co',
  'sb_publishable_5QpJJS57WhAhHgx_owP8Lw_0CpXYy4Q'
);

const DEFAULT_PRICING={bwSingle:2,bwDouble:3,colourSingle:5,colourDouble:10};
const CUSTOMER_APP_URL=(import.meta.env.VITE_CUSTOMER_APP_URL||'https://scanpress-customer.vercel.app/customer.html').replace(/\/$/,'');
const formatSerial=n=>`SP${String(n).padStart(6,'0')}`;
const cleanPhone=v=>v.replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'');

export default function Signup(){
  const navigate=useNavigate();
  const {setShopName,setOwnerName,setPhone,setEmail}=useApp();
  const [form,setForm]=useState({
    ownerName:'',shopName:'',email:'',phone:'',password:'',confirmPassword:''
  });
  const [showPassword,setShowPassword]=useState(false);
  const [showConfirmPassword,setShowConfirmPassword]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const update=(field,value)=>{
    setForm(p=>({...p,[field]:value}));
    setError('');
  };

  const validate=()=>{
    const {ownerName,shopName,email,phone,password,confirmPassword}=form;
    if(!ownerName.trim()||!shopName.trim()||!email.trim()||!phone.trim()||!password||!confirmPassword)return 'Please fill all fields';
    if(ownerName.trim().length<2)return 'Enter a valid owner name';
    if(shopName.trim().length<2)return 'Enter a valid shop name';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return 'Enter a valid email address';
    if(!/^\d{10}$/.test(cleanPhone(phone)))return 'Enter a valid 10-digit phone number';
    if(password.length<6)return 'Password must be at least 6 characters';
    if(password!==confirmPassword)return 'Passwords do not match';
    return '';
  };

  const handleSubmit=async e=>{
    e.preventDefault();
    if(loading)return;

    setError('');
    const validationError=validate();
    if(validationError)return setError(validationError);

    const mobile=cleanPhone(form.phone);
    const email=form.email.trim().toLowerCase();
    let createdUser=null,shopRef=null,allocatedNumber=0;

    try{
      setLoading(true);

      /* 1. Firebase Authentication */
      const {user}=await createUserWithEmailAndPassword(auth,email,form.password);
      createdUser=user;

      const counterRef=doc(db,'system','shopCounter');
      shopRef=doc(db,'shops',user.uid);

      /* 2. Allocate serial + create shop */
      await runTransaction(db,async tx=>{
        const snap=await tx.get(counterRef);
        const data=snap.exists()?snap.data():{};
        const last=Number(data.lastSerialNumber||0);
        const free=Array.isArray(data.availableSerialNumbers)
          ? data.availableSerialNumbers.map(Number).filter(n=>Number.isInteger(n)&&n>0).sort((a,b)=>a-b)
          : [];

        allocatedNumber=free.length?free.shift():last+1;
        const serialNumber=formatSerial(allocatedNumber);
        const qrUrl=`${CUSTOMER_APP_URL}?serial=${serialNumber}`;

        tx.set(counterRef,{
          activeCount:Number(data.activeCount||0)+1,
          lastSerialNumber:Math.max(last,allocatedNumber),
          availableSerialNumbers:free,
          updatedAt:serverTimestamp()
        },{merge:true});

        tx.set(shopRef,{
          serialNumber,
          ownerName:form.ownerName.trim(),
          shopName:form.shopName.trim(),
          email,
          phone:mobile,
          pricing:{...DEFAULT_PRICING},
          qrUrl,
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp(),
          lastActiveAt:serverTimestamp()
        });
      });

      /* 3. Supabase shop */
      const {error:supabaseError}=await supabase.from('shops').insert({
        firebase_uid:user.uid,
        serial_number:formatSerial(allocatedNumber),
        shop_name:form.shopName.trim()
      });

      if(supabaseError)throw supabaseError;

      /* 4. App state */
      setShopName(form.shopName.trim());
      setOwnerName(form.ownerName.trim());
      setPhone(mobile);
      setEmail(email);

      localStorage.setItem('shopName',form.shopName.trim());
      localStorage.setItem('ownerName',form.ownerName.trim());
      localStorage.setItem('phone',mobile);
      localStorage.setItem('email',email);
      localStorage.setItem('shopSerialNumber',formatSerial(allocatedNumber));

      navigate('/home',{replace:true});
    }catch(err){
      console.error('SCANPRESS SIGNUP ERROR:',err);

      /* 5. Rollback */
      if(allocatedNumber){
        try{
          await runTransaction(db,async tx=>{
            const ref=doc(db,'system','shopCounter');
            const snap=await tx.get(ref);
            const data=snap.exists()?snap.data():{};
            const free=Array.isArray(data.availableSerialNumbers)
              ? data.availableSerialNumbers.map(Number)
              : [];

            if(!free.includes(allocatedNumber))free.push(allocatedNumber);

            tx.set(ref,{
              activeCount:Math.max(0,Number(data.activeCount||0)-1),
              availableSerialNumbers:free.sort((a,b)=>a-b),
              updatedAt:serverTimestamp()
            },{merge:true});
          });
        }catch(e){
          console.error('COUNTER ROLLBACK FAILED:',e);
        }
      }

      if(shopRef){
        try{await deleteDoc(shopRef)}
        catch(e){console.error('FIRESTORE ROLLBACK FAILED:',e)}
      }

      if(createdUser){
        try{await deleteUser(createdUser)}
        catch(e){console.error('AUTH ROLLBACK FAILED:',e)}
      }

      switch(err?.code){
        case 'auth/email-already-in-use':setError('Email already registered');break;
        case 'auth/invalid-email':setError('Enter a valid email address');break;
        case 'auth/weak-password':setError('Password must be at least 6 characters');break;
        case 'auth/network-request-failed':setError('Network error. Check your connection.');break;
        case 'permission-denied':
        case 'firestore/permission-denied':setError('Database permission denied. Check Firestore Rules.');break;
        default:setError(err?.message||'Failed to create account. Please try again.');
      }
    }finally{
      setLoading(false);
    }
  };

  const {ownerName,shopName,email,phone,password,confirmPassword}=form;

  return(
    <main className="auth-screen">
      <section className="auth-wrap">
        <div className="auth-logo-row">
          <div className="auth-logo-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5h-2"/><path d="M6 14h12v8H6v-8z"/>
            </svg>
          </div>
          <div className="auth-logo-text">Scan<em>Press</em></div>
        </div>

        <form className="auth-card signup-card" onSubmit={handleSubmit} autoComplete="off">
          <h1 className="auth-heading">Create account</h1>
          <p className="auth-sub">Set up your print shop in seconds</p>

          <Field label="Owner Name"><input className="field" type="text" placeholder="Your name" value={ownerName} autoComplete="name" onChange={e=>update('ownerName',e.target.value)}/></Field>
          <Field label="Shop Name"><input className="field" type="text" placeholder="Shop name" value={shopName} autoComplete="organization" onChange={e=>update('shopName',e.target.value)}/></Field>
          <Field label="Email"><input className="field" type="email" placeholder="Email address" value={email} autoComplete="email" onChange={e=>update('email',e.target.value)}/></Field>
          <Field label="Phone Number"><input className="field" type="tel" inputMode="numeric" maxLength="10" placeholder="9876543210" value={phone} autoComplete="tel" onChange={e=>update('phone',e.target.value.replace(/\D/g,''))}/></Field>

          <div className="field-row">
            <PasswordInput label="Password" value={password} show={showPassword} setShow={setShowPassword} onChange={v=>update('password',v)}/>
            <PasswordInput label="Confirm Password" value={confirmPassword} show={showConfirmPassword} setShow={setShowConfirmPassword} onChange={v=>update('confirmPassword',v)}/>
          </div>

          {error&&<div className="err-msg">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading?'Creating...':'Create Account'}
          </button>

          <div className="auth-footer">
            Already have an account?{' '}
            <button type="button" className="auth-link-button" onClick={()=>navigate('/login')}>Sign in</button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({label,children}){
  return <div className="field-group"><label className="field-label">{label}</label>{children}</div>
}

function PasswordInput({label,value,show,setShow,onChange}){
  return(
    <div>
      <label className="field-label">{label}</label>
      <div className="password-field">
        <input className="field" type={show?'text':'password'} placeholder="••••••••" value={value} autoComplete="off" onChange={e=>onChange(e.target.value)}/>
        <button type="button" className="password-toggle" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>
          {show?<EyeOff size={18}/>:<Eye size={18}/>}
        </button>
      </div>
    </div>
  );
}