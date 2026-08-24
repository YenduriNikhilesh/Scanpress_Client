import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  EmailAuthProvider,reauthenticateWithCredential,updatePassword,signOut
} from 'firebase/auth';
import {
  doc,setDoc,getDoc,collection,addDoc,serverTimestamp
} from 'firebase/firestore';
import Topbar from './Topbar';
import {supabase} from '../services/supabase';
import {auth,db} from '../services/firebase';
import {useApp} from '../services/AppContext';
import '../styles/settings.css';

const DELETE_FUNCTION='https://eacrbqwxcczaakpuvgrp.supabase.co/functions/v1/delete-account';

export default function Settings(){
  const {shopName,setShopName,ownerName,setOwnerName,pricing,setPricing,showToast}=useApp();
  const user=auth.currentUser,navigate=useNavigate();

  const [name,setName]=useState(ownerName||''),[shop,setShop]=useState(shopName||'');
  const [phone,setPhone]=useState(''),[email,setEmail]=useState(user?.email||'');
  const [bwS,setBwS]=useState(String(pricing.bwS)),[bwD,setBwD]=useState(String(pricing.bwD));
  const [colS,setColS]=useState(String(pricing.colS)),[colD,setColD]=useState(String(pricing.colD));
  const [a4S,setA4S]=useState(String(pricing.a4S)),[a4D,setA4D]=useState(String(pricing.a4D));
  const [legS,setLegS]=useState(String(pricing.legS)),[legD,setLegD]=useState(String(pricing.legD));
  const [modalType,setModalType]=useState(null),[deletingAccount,setDeletingAccount]=useState(false);
  const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState(''),[changingPassword,setChangingPassword]=useState(false);
  const [supportSubject,setSupportSubject]=useState(''),[supportMsg,setSupportMsg]=useState('');
  const [bugType,setBugType]=useState('UI Bug'),[bugDesc,setBugDesc]=useState(''),[bugSteps,setBugSteps]=useState('');

  useEffect(()=>{
    if(!user)return;
    getDoc(doc(db,'shops',user.uid)).then(s=>{
      if(!s.exists())return setEmail(user.email||'');
      const d=s.data();
      setName(d.ownerName||'');setShop(d.shopName||'');setPhone(d.phone||'');
      setEmail(d.email||user.email||'');
      if(d.pricing){
        setBwS(String(d.pricing.bwS??2));setBwD(String(d.pricing.bwD??3));
        setColS(String(d.pricing.colS??10));setColD(String(d.pricing.colD??18));
        setA4S(String(d.pricing.a4S??2));setA4D(String(d.pricing.a4D??3.5));
        setLegS(String(d.pricing.legS??3));setLegD(String(d.pricing.legD??5));
      }
    }).catch(e=>console.error('Load settings error:',e));
  },[user]);

  async function handleSave(){
    if(!user)return;
    const p={
      bwS:parseFloat(bwS)||2,bwD:parseFloat(bwD)||3,
      colS:parseFloat(colS)||10,colD:parseFloat(colD)||18,
      a4S:parseFloat(a4S)||2,a4D:parseFloat(a4D)||3.5,
      legS:parseFloat(legS)||3,legD:parseFloat(legD)||5
    };
    try{
      await setDoc(doc(db,'shops',user.uid),{
        ownerName:name.trim(),shopName:shop.trim(),phone,email,pricing:p
      },{merge:true});
      setShopName(shop.trim());setOwnerName(name.trim());setPricing(p);
      showToast('Settings updated successfully');
    }catch(e){console.error(e);showToast('Failed to save settings')}
  }

  async function handleChangePassword(){
    if(!user||!user.email)return showToast('Password change is unavailable for this account');
    if(!currentPassword.trim())return showToast('Please enter your current password');
    if(!newPassword.trim())return showToast('Please enter a new password');
    if(newPassword.length<6)return showToast('Password must be at least 6 characters');
    if(!confirmPassword.trim())return showToast('Please confirm your new password');
    if(newPassword!==confirmPassword)return showToast('Passwords do not match');
    if(currentPassword===newPassword)return showToast('New password must be different');

    try{
      setChangingPassword(true);
      await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));
      await updatePassword(user,newPassword);
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
      setModalType(null);showToast('Password changed successfully');
    }catch(e){
      console.error(e);
      if(e.code==='auth/wrong-password'||e.code==='auth/invalid-credential')showToast('Current password is incorrect');
      else if(e.code==='auth/weak-password')showToast('Password must be at least 6 characters');
      else if(e.code==='auth/too-many-requests')showToast('Too many attempts. Please try again later');
      else showToast('Unable to change password. Please try again');
    }finally{setChangingPassword(false)}
  }

  async function handleSupportSubmit(){
    if(!supportSubject.trim()||!supportMsg.trim())return showToast('Please fill out all support ticket fields');
    try{
      await addDoc(collection(db,'support_tickets'),{
        shopId:user?.uid||'guest',email:email||user?.email||'',
        subject:supportSubject.trim(),message:supportMsg.trim(),timestamp:serverTimestamp()
      });
      setSupportSubject('');setSupportMsg('');setModalType(null);
      showToast('Support ticket submitted successfully!');
    }catch(e){console.error(e);showToast('Failed to submit support ticket')}
  }

  async function handleBugReportSubmit(){
    if(!bugDesc.trim())return showToast('Please describe the problem');
    try{
      await addDoc(collection(db,'bug_reports'),{
        shopId:user?.uid||'guest',email:email||user?.email||'',type:bugType,
        description:bugDesc.trim(),steps:bugSteps.trim(),timestamp:serverTimestamp()
      });
      setBugDesc('');setBugSteps('');setModalType(null);
      showToast('Bug report submitted successfully! Thank you!');
    }catch(e){console.error(e);showToast('Failed to submit bug report')}
  }

  // Delete everything through the secure Supabase Edge Function.
  async function handleDeleteAccount(){
    if(!user||deletingAccount)return;

    try{
      setDeletingAccount(true);

      const token=await user.getIdToken(true);

      const response=await fetch(DELETE_FUNCTION,{
        method:'POST',
        headers:{
          Authorization:`Bearer ${token}`,
          'Content-Type':'application/json'
        }
      });

      const result=await response.json().catch(()=>({}));

      if(!response.ok)
        throw new Error(result.error||result.message||'Account deletion failed');

      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();

      setShopName('');
      setOwnerName('');
      setModalType(null);
      navigate('/login',{replace:true});
    }catch(e){
      console.error('Delete account error:',e);
      showToast(
        e.code==='auth/requires-recent-login'
          ? 'Please log in again before deleting your account'
          : e.message||'Unable to delete account. Please try again'
      );
    }finally{
      setDeletingAccount(false);
    }
  }

  function closePassword(){
    setCurrentPassword('');setNewPassword('');setConfirmPassword('');
    setChangingPassword(false);setModalType(null);
  }

  function closeModal(){
    modalType==='change-password'?closePassword():setModalType(null);
  }

  return(
    <div className="app-screen" style={{display:'flex',flexDirection:'column',minHeight:'100dvh',position:'relative',zIndex:1}}>
      <Topbar variant="settings"/>

      <div className="settings-body">
        <div className="profile-section">
          <div className="avatar">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="avatar-name">{shop||'Print Shop'}</div>
          <div className="avatar-role">Shop Owner</div>
        </div>

        <div style={{height:22}}/>

        <Section title="Profile Information">
          <Field label="Name"><input placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/></Field>
          <Field label="Shop Name"><input placeholder="Your shop name" value={shop} onChange={e=>setShop(e.target.value)}/></Field>
          <Field label="Phone Number"><input type="tel" inputMode="tel" placeholder="9876543210" value={phone} onChange={e=>setPhone(e.target.value)}/></Field>
          <Field label="Email"><input type="email" inputMode="email" value={email} disabled/></Field>

          <div className="settings-field password-settings-field">
            <div className="password-field-header">
              <label>PASSWORD</label>
              <button type="button" className="change-password-btn" onClick={()=>{
                setCurrentPassword('');setNewPassword('');setConfirmPassword('');
                setModalType('change-password');
              }}>Change Password</button>
            </div>
            <div className="password-masked">********</div>
          </div>
        </Section>

        <button type="button" className="my-orders-card" onClick={()=>navigate('/orders')}>
          <div className="my-orders-icon">🛍️</div>
          <div className="my-orders-content">
            <div className="my-orders-title">MY ORDERS</div>
            <div className="my-orders-subtitle">View your ScanPress purchases</div>
          </div>
          <div className="my-orders-action"><span>View</span><span className="my-orders-arrow">→</span></div>
        </button>

        <Section title="Print Pricing — ₹ per page">
          <div className="pricing-header">
            <span className="pricing-col-label">Type</span>
            <span className="pricing-col-label">1-Sided</span>
            <span className="pricing-col-label">2-Sided</span>
          </div>
          <PricingRow label="B/W" single={bwS} onSingle={setBwS} double={bwD} onDouble={setBwD}/>
          <PricingRow label="Colour" single={colS} onSingle={setColS} double={colD} onDouble={setColD}/>
          <PricingRow label="A3/A5/A4" single={a4S} onSingle={setA4S} double={a4D} onDouble={setA4D}/>
          <PricingRow label="Letter/Legal" single={legS} onSingle={setLegS} double={legD} onDouble={setLegD}/>
        </Section>

        <div className="save-row"><button className="btn-primary" onClick={handleSave}>Save Changes</button></div>

        <LinkSection title="HELP & SUPPORT">
          <LinkItem icon="❓" text="Help Center" onClick={()=>setModalType('help')}/>
          <LinkItem icon="💬" text="Contact Support" onClick={()=>setModalType('support')}/>
          <LinkItem icon="🐛" text="Report a Problem" onClick={()=>setModalType('bug')}/>
        </LinkSection>

        <LinkSection title="LEGAL">
          <LinkItem icon="🔒" text="Privacy Policy" onClick={()=>setModalType('privacy')}/>
          <LinkItem icon="📄" text="Terms & Conditions" onClick={()=>setModalType('terms')}/>
          <LinkItem icon="ℹ️" text="About ScanPress" onClick={()=>setModalType('about')}/>
        </LinkSection>

        <div className="delete-account-section">
          <button type="button" className="delete-account-btn" onClick={()=>setModalType('delete-account')}>Delete Account</button>
        </div>

        <div className="footer-note">© 2026 ScanPress. All rights reserved.</div>
      </div>

      {modalType&&(
        <div className="settings-modal-overlay" onClick={closeModal}>
          <div className="settings-modal" onClick={e=>e.stopPropagation()}>

            {modalType==='change-password'&&(
              <>
                <ModalTitle title="Change Password" onClose={closePassword}/>
                <div className="settings-modal-content password-modal-content">
                  <div className="password-modal-intro">Update your ScanPress account password.</div>
                  <PasswordField label="CURRENT PASSWORD" value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" autoFocus/>
                  <PasswordField label="NEW PASSWORD" value={newPassword} onChange={setNewPassword} placeholder="Enter new password"/>
                  <PasswordField label="CONFIRM PASSWORD" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password"/>
                  <div className="password-help-text">Use at least 6 characters.</div>
                </div>
                <div className="password-modal-footer">
                  <button className="password-cancel-btn" onClick={closePassword} disabled={changingPassword}>Cancel</button>
                  <button className="password-save-btn" onClick={handleChangePassword} disabled={changingPassword}>
                    {changingPassword?'Updating...':'Save Password'}
                  </button>
                </div>
              </>
            )}

            {modalType==='delete-account'&&(
              <>
                <ModalTitle title="Delete Account" onClose={()=>setModalType(null)}/>
                <div className="settings-modal-content delete-account-modal-content">
                  <div className="delete-warning-icon">⚠️</div>
                  <h3>Permanently delete your account?</h3>
                  <p>This will permanently remove your ScanPress account and its data.</p>
                  <p className="delete-warning-text">This action cannot be undone.</p>
                </div>
                <div className="password-modal-footer">
                  <button className="password-cancel-btn" onClick={()=>setModalType(null)} disabled={deletingAccount}>Cancel</button>
                  <button className="delete-confirm-btn" onClick={handleDeleteAccount} disabled={deletingAccount}>
                    {deletingAccount?'Deleting...':'Confirm'}
                  </button>
                </div>
              </>
            )}

            {modalType==='help'&&<InfoModal title="Help Center" onClose={()=>setModalType(null)}>
              <h4>How ScanPress Works</h4>
              <p>Customers scan your shop's QR code and submit their print request securely.</p>
              <p>The request appears in your Queue where you can review the document, price and print it.</p>
              <h4>Need Help?</h4>
              <p>If something is not working correctly, use Contact Support or Report a Problem.</p>
            </InfoModal>}

            {modalType==='support'&&(
              <>
                <ModalTitle title="Contact Support" onClose={()=>setModalType(null)}/>
                <div className="settings-modal-content">
                  <Field label="Subject"><input placeholder="What do you need help with?" value={supportSubject} onChange={e=>setSupportSubject(e.target.value)}/></Field>
                  <Field label="Message"><textarea placeholder="Describe your issue..." value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} rows={5}/></Field>
                </div>
                <div className="modal-actions">
                  <button className="modal-secondary-btn" onClick={()=>setModalType(null)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSupportSubmit}>Send Message</button>
                </div>
              </>
            )}

            {modalType==='bug'&&(
              <>
                <ModalTitle title="Report a Problem" onClose={()=>setModalType(null)}/>
                <div className="settings-modal-content">
                  <Field label="Problem Type">
                    <select value={bugType} onChange={e=>setBugType(e.target.value)}>
                      <option>UI Bug</option><option>Printer Problem</option><option>Queue Problem</option>
                      <option>Payment Problem</option><option>Account Problem</option><option>Other</option>
                    </select>
                  </Field>
                  <Field label="Describe the Problem"><textarea placeholder="Tell us what went wrong..." value={bugDesc} onChange={e=>setBugDesc(e.target.value)} rows={5}/></Field>
                  <Field label="Steps to Reproduce"><textarea placeholder="What were you doing when the problem occurred?" value={bugSteps} onChange={e=>setBugSteps(e.target.value)} rows={4}/></Field>
                </div>
                <div className="modal-actions">
                  <button className="modal-secondary-btn" onClick={()=>setModalType(null)}>Cancel</button>
                  <button className="btn-primary" onClick={handleBugReportSubmit}>Submit Report</button>
                </div>
              </>
            )}

            {modalType==='privacy'&&<InfoModal title="Privacy Policy" onClose={()=>setModalType(null)}>
              <h4>Your Privacy Matters</h4>
              <p>ScanPress is designed to securely manage print requests between customers and print shops.</p>
              <h4>Information We Store</h4>
              <p>Your account information, shop information, pricing settings and print-related information may be stored to provide the ScanPress service.</p>
              <h4>Data Security</h4>
              <p>We use appropriate security measures to protect your account and application data.</p>
            </InfoModal>}

            {modalType==='terms'&&<InfoModal title="Terms & Conditions" onClose={()=>setModalType(null)}>
              <h4>Using ScanPress</h4>
              <p>By using ScanPress, you agree to use the service responsibly and only for legitimate printing activities.</p>
              <h4>Print Requests</h4>
              <p>Shop owners are responsible for reviewing customer print requests before printing.</p>
              <h4>Account Responsibility</h4>
              <p>You are responsible for keeping your ScanPress account credentials secure.</p>
            </InfoModal>}

            {modalType==='about'&&<InfoModal title="About ScanPress" onClose={()=>setModalType(null)}>
              <div className="about-logo">ScanPress</div>
              <p className="about-tagline">The fastest way to print.</p>
              <p>ScanPress connects customers with print shops through a simple QR-based printing experience.</p>
              <p>Customers scan a QR code, submit their documents, and the shop owner receives the request directly in the printing queue.</p>
              <p className="about-version">Version 1.0.0</p>
            </InfoModal>}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({title,children}){return <div className="settings-section"><div className="settings-section-title">{title}</div>{children}</div>}

function LinkSection({title,children}){
  return <div className="settings-section settings-link-section"><div className="settings-section-title">{title}</div><div className="settings-link-list">{children}</div></div>
}

function LinkItem({icon,text,onClick}){
  return <button className="settings-link" onClick={onClick}><span className="settings-link-left"><span className="settings-link-icon">{icon}</span><span>{text}</span></span><span className="settings-link-arrow">›</span></button>
}

function Field({label,children}){return <div className="settings-field"><label>{label}</label>{children}</div>}

function ModalTitle({title,onClose}){
  return <div className="settings-modal-title password-modal-header"><div>{title}</div><button type="button" className="password-modal-close" onClick={onClose}>×</button></div>
}

function InfoModal({title,children,onClose}){
  return <>
    <div className="settings-modal-title password-modal-header"><div>{title}</div><button type="button" className="password-modal-close" onClick={onClose}>×</button></div>
    <div className="settings-modal-content">{children}</div>
    <div className="modal-actions"><button className="modal-secondary-btn" onClick={onClose}>Close</button></div>
  </>
}

function PasswordField({label,value,onChange,placeholder,autoFocus}){
  return <div className="password-input-group"><label>{label}</label><input type="password" placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={e=>onChange(e.target.value)}/></div>
}

function PricingRow({label,single,onSingle,double:dbl,onDouble}){
  return <div className="pricing-row"><span className="pricing-type">{label}</span><PriceInput value={single} onChange={onSingle}/><PriceInput value={dbl} onChange={onDouble}/></div>
}

function PriceInput({value,onChange}){
  return <div className="pricing-input-wrap"><span className="pricing-symbol">₹</span><input className="pricing-input" type="number" min="0" step="0.5" value={value} onChange={e=>onChange(e.target.value)}/></div>
}