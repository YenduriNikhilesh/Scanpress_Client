import {createContext,useContext,useState,useCallback,useRef,useEffect} from 'react';
import {auth,db} from './firebase';
import {onAuthStateChanged} from 'firebase/auth';
import {doc,setDoc,serverTimestamp,onSnapshot} from 'firebase/firestore';
import {createClient} from '@supabase/supabase-js';
import {nowTime} from '../utils/helpers';

const supabase=createClient(
  'https://eacrbqwxcczaakpuvgrp.supabase.co',
  'sb_publishable_5QpJJS57WhAhHgx_owP8Lw_0CpXYy4Q'
);

const BUCKET='scanpress-temp';

const INITIAL_PRICING={
  bwS:2,bwD:3,colS:10,colD:18,a4S:2,a4D:3.5,legS:3,legD:5
};

const INITIAL_ADDRESS={
  name:'',
  phone:'',
  line1:'',
  line2:'',
  city:'',
  state:'',
  pincode:'',
  isDefault:true
};

const AppContext=createContext(null);

export function AppProvider({children}){
  const [loading,setLoading]=useState(true);
  const [shopId,setShopId]=useState('');
  const [serialNumber,setSerialNumber]=useState('');
  const [ownerName,setOwnerName]=useState('');
  const [shopName,setShopName]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [qrUrl,setQrUrl]=useState('');
  const [addresses,setAddresses]=useState([]);
  const [defaultAddress,setDefaultAddress]=useState(INITIAL_ADDRESS);
  const [pricing,setPricing]=useState(INITIAL_PRICING);
  const [jobs,setJobs]=useState([]);
  const [orders,setOrders]=useState([]);
  const [todayPrints,setTodayPrints]=useState(0);
  const [todayRevenue,setTodayRevenue]=useState(0);
  const [toast,setToast]=useState({msg:'',show:false});
  const [alert,setAlert]=useState({msg:'',show:false});

  const toastTimer=useRef(null);
  const alertTimer=useRef(null);
  const knownJobIds=useRef(new Set());
  const queueInitialized=useRef(false);
  const updatingJobs=useRef(new Set());
  const todayPrintsRef=useRef(0);
  const todayRevenueRef=useRef(0);

  const shopUrl=qrUrl;
  const setShopUrl=setQrUrl;

  const todayKey=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const counterDateRef=useRef(todayKey());

  // ======================================================
  // DAILY SUCCESSFUL PRINTS
  // ======================================================

  const loadTodayPrints=useCallback(async()=>{
    const serial=serialNumber.trim();
    const statDate=todayKey();
    if(!serial)return;

    const {data,error}=await supabase.rpc('get_shop_daily_prints',{
      p_serial_number:serial,
      p_stat_date:statDate
    });

    if(error)return;

    const next=Number(data)||0;
    if(statDate===counterDateRef.current&&next===0&&todayPrintsRef.current>0)return;

    counterDateRef.current=statDate;
    todayPrintsRef.current=next;
    setTodayPrints(next);
  },[serialNumber]);

  // ======================================================
  // DAILY REVENUE
  // ======================================================

  const loadTodayRevenue=useCallback(async()=>{
    const serial=serialNumber.trim();
    const statDate=todayKey();
    if(!serial)return;

    const {data,error}=await supabase.rpc('get_shop_daily_revenue',{
      p_serial_number:serial,
      p_stat_date:statDate
    });

    if(error)return;

    const next=Number(data)||0;
    if(statDate===counterDateRef.current&&next===0&&todayRevenueRef.current>0)return;

    todayRevenueRef.current=next;
    setTodayRevenue(next);
  },[serialNumber]);

  // ======================================================
  // AUTH + REALTIME SHOP PROFILE
  // ======================================================

  useEffect(()=>{
    let unsubProfile=null;

    const unsubAuth=onAuthStateChanged(auth,async user=>{
      try{
        unsubProfile?.();
        unsubProfile=null;

        knownJobIds.current=new Set();
        queueInitialized.current=false;
        updatingJobs.current.clear();

        if(!user){
          setShopId('');
          setSerialNumber('');
          setOwnerName('');
          setShopName('');
          setPhone('');
          setEmail('');
          setQrUrl('');
          setAddresses([]);
          setDefaultAddress(INITIAL_ADDRESS);
          setPricing(INITIAL_PRICING);
          setJobs([]);
          setOrders([]);
          todayPrintsRef.current=0;
          todayRevenueRef.current=0;
          counterDateRef.current=todayKey();
          setTodayPrints(0);
          setTodayRevenue(0);
          setLoading(false);
          return;
        }

        setLoading(true);
        setShopId(user.uid);

        // REALTIME FIRESTORE SHOP LISTENER
        const shopRef=doc(db,'shops',user.uid);

        unsubProfile=onSnapshot(
          shopRef,
          snap=>{
            if(!snap.exists()){
              setLoading(false);
              return;
            }

            const data=snap.data();
            const list=Array.isArray(data.addresses)?data.addresses:[];

            setSerialNumber(data.serialNumber||'');
            setOwnerName(data.ownerName||'');
            setShopName(data.shopName||'');
            setPhone(data.phone||user.phoneNumber||'');
            setEmail(data.email||user.email||'');
            setQrUrl(data.qrUrl||'');
            setAddresses(list);
            setDefaultAddress(
              list.find(a=>a.isDefault)||
              list[0]||
              INITIAL_ADDRESS
            );
            setPricing({
              ...INITIAL_PRICING,
              ...(data.pricing||{})
            });
            setLoading(false);
          },
          error=>{
            console.error('Shop profile listener:',error);
            setLoading(false);
          }
        );
      }catch(error){
        console.error('Auth/profile error:',error);
        setLoading(false);
      }
    });

    return()=>{
      unsubAuth();
      unsubProfile?.();
    };
  },[]);

  // ======================================================
  // LOAD TODAY'S COUNTER + REVENUE
  // ======================================================

  useEffect(()=>{
    if(!serialNumber){
      todayPrintsRef.current=0;
      todayRevenueRef.current=0;
      counterDateRef.current=todayKey();
      setTodayPrints(0);
      setTodayRevenue(0);
      return;
    }

    loadTodayPrints();
    loadTodayRevenue();

    const timer=setInterval(()=>{
      loadTodayPrints();
      loadTodayRevenue();
    },30000);

    return()=>clearInterval(timer);
  },[serialNumber,loadTodayPrints,loadTodayRevenue]);

  // ======================================================
  // CUSTOMER ORDERS
  // ======================================================

  const loadOrders=useCallback(async()=>{
    const serial=serialNumber.trim();

    if(!serial){
      setOrders([]);
      return;
    }

    const {data,error}=await supabase.rpc('get_shop_orders',{
      p_serial_number:serial
    });

    if(error){
      console.error('Orders load:',error);
      setOrders([]);
      return;
    }

    setOrders(data||[]);
  },[serialNumber]);

  useEffect(()=>{
    loadOrders();
  },[loadOrders]);

  // ======================================================
  // REALTIME CUSTOMER ORDERS
  // ======================================================

  useEffect(()=>{
    const serial=serialNumber.trim();

    if(!serial){
      setOrders([]);
      return;
    }

    const channel=supabase
      .channel(`orders-${serial}`)
      .on(
        'postgres_changes',
        {
          event:'*',
          schema:'public',
          table:'shop_orders',
          filter:`serial_number=eq.${serial}`
        },
        loadOrders
      )
      .subscribe();

    return()=>{
      supabase.removeChannel(channel);
    };
  },[serialNumber,loadOrders]);

  // ======================================================
  // PLACE CUSTOMER ORDER
  // ======================================================

  const placeShopOrder=useCallback(async({
    items,
    address,
    payment='cod',
    subtotal
  })=>{
    const serial=serialNumber.trim();

    if(!serial)throw new Error('Shop not found.');
    if(!Array.isArray(items)||!items.length)
      throw new Error('Your cart is empty.');
    if(!address)
      throw new Error('Delivery address is required.');

    const cleanItems=items.map(item=>({
      id:item.id,
      quantity:Math.max(1,Number(item.quantity||1))
    }));

    const {data,error}=await supabase.rpc('place_shop_order',{
      p_serial_number:serial,
      p_items:cleanItems,
      p_address:address,
      p_payment_method:payment,
      p_subtotal:Number(subtotal)||0
    });

    if(error){
      console.error('Place order:',error);
      throw error;
    }

    await loadOrders();

    return data;
  },[serialNumber,loadOrders]);

  // ======================================================
  // QUEUE
  // ======================================================

  useEffect(()=>{
    if(!serialNumber){
      setJobs([]);
      knownJobIds.current=new Set();
      queueInitialized.current=false;
      return;
    }

    let active=true;

    const normalizeStatus=s=>{
      s=(s||'pending').toLowerCase();
      if(s==='success'||s==='completed'||s==='done')return'done';
      if(s==='cancel'||s==='cancelled')return'cancelled';
      return s;
    };

    const formatJobs=async rows=>{
      return Promise.all((rows||[]).map(async job=>{
        const files=await Promise.all((job.files||[]).map(async f=>{
          let url='';

          if(f.file_path){
            const {data,error}=await supabase.storage
              .from(BUCKET)
              .createSignedUrl(f.file_path,3600);

            if(!error)url=data?.signedUrl||'';
          }

          return{
            id:f.id,
            n:f.file_name,
            e:f.file_name?.split('.').pop()?.toLowerCase()||'file',
            s:formatSize(f.file_size),
            size:f.file_size,
            bucket:BUCKET,
            path:f.file_path,
            url,
            mime:f.mime_type||'application/octet-stream'
          };
        }));

        return{
          id:job.job_id||job.id,
          name:job.customer_name||'Customer',
          notes:job.notes||'',
          files,
          status:normalizeStatus(job.status),
          time:job.created_at
            ?new Date(job.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            }):'',
          timestamp:job.created_at
            ?new Date(job.created_at).getTime():Date.now(),
          copies:job.copies||1,
          paperSize:job.paper_size||'A4',
          printType:job.print_type||'bw',
          sides:job.sides||'single',
          expiresAt:job.expires_at||null
        };
      }));
    };

    const loadJobs=async()=>{
      const {data,error}=await supabase.rpc('get_shop_queue',{
        p_serial_number:serialNumber
      });

      if(error){
        if(active)setJobs([]);
        return;
      }

      const rows=data||[];
      const currentIds=new Set(
        rows.map(j=>j.job_id||j.id).filter(Boolean)
      );

      if(!queueInitialized.current){
        knownJobIds.current=currentIds;
        queueInitialized.current=true;
      }else{
        const newJobs=rows.filter(j=>{
          const id=j.job_id||j.id;
          const status=normalizeStatus(j.status);
          return id&&!knownJobIds.current.has(id)&&status==='pending';
        });

        if(newJobs.length){
          showAlert(
            newJobs.length===1
              ?'New print request received'
              :`${newJobs.length} new print requests received`
          );
        }

        knownJobIds.current=currentIds;
      }

      const formatted=await formatJobs(rows);
      formatted.sort((a,b)=>b.timestamp-a.timestamp);

      if(active)setJobs(formatted);
    };

    loadJobs();

    const timer=setInterval(loadJobs,60000);

    let refreshTimer=null;
    const refresh=()=>{
      clearTimeout(refreshTimer);
      refreshTimer=setTimeout(loadJobs,80);
    };

    const channel=supabase
      .channel(`queue-${serialNumber}`)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'print_jobs',
        filter:`shop_id=eq.${shopId}`
      },refresh)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'job_files'
      },refresh)
      .subscribe();

    return()=>{
      active=false;
      clearInterval(timer);
      clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  },[serialNumber]);

  // ======================================================
  // SHOP PROFILE
  // ======================================================

  const saveShopProfile=useCallback(async(updates={})=>{
    if(!shopId)throw new Error('No authenticated shop found.');

    const allowed={};

    if('ownerName'in updates)
      allowed.ownerName=String(updates.ownerName||'').trim();

    if('shopName'in updates)
      allowed.shopName=String(updates.shopName||'').trim();

    if('phone'in updates)
      allowed.phone=String(updates.phone||'').trim();

    if('email'in updates)
      allowed.email=String(updates.email||'').trim();

    if('qrUrl'in updates)
      allowed.qrUrl=String(updates.qrUrl||'').trim();

    if('serialNumber'in updates)
      allowed.serialNumber=String(updates.serialNumber||'').trim();

    if('pricing'in updates)
      allowed.pricing={
        ...INITIAL_PRICING,
        ...(updates.pricing||{})
      };

    if('addresses'in updates)
      allowed.addresses=Array.isArray(updates.addresses)
        ?updates.addresses
        :[];

    await setDoc(
      doc(db,'shops',shopId),
      {...allowed,updatedAt:serverTimestamp()},
      {merge:true}
    );

    // INSTANT LOCAL UPDATE
    if('ownerName'in allowed)setOwnerName(allowed.ownerName);
    if('shopName'in allowed)setShopName(allowed.shopName);
    if('phone'in allowed)setPhone(allowed.phone);
    if('email'in allowed)setEmail(allowed.email);
    if('qrUrl'in allowed)setQrUrl(allowed.qrUrl);
    if('serialNumber'in allowed)setSerialNumber(allowed.serialNumber);
    if('pricing'in allowed)setPricing(allowed.pricing);

    if('addresses'in allowed){
      setAddresses(allowed.addresses);
      setDefaultAddress(
        allowed.addresses.find(a=>a.isDefault)||
        allowed.addresses[0]||
        INITIAL_ADDRESS
      );
    }

    showToast('Changes saved successfully');
  },[shopId]);

  // ======================================================
  // ADDRESSES
  // ======================================================

  const saveAddresses=useCallback(
    next=>saveShopProfile({
      addresses:Array.isArray(next)?next:[]
    }),
    [saveShopProfile]
  );

  const addAddress=useCallback(async address=>{
    const item={
      ...INITIAL_ADDRESS,
      ...address,
      id:address?.id||`address_${Date.now()}`
    };

    let next=[...addresses,item];

    if(next.length===1)
      next=next.map(a=>({...a,isDefault:true}));

    if(item.isDefault)
      next=next.map(a=>({...a,isDefault:a.id===item.id}));

    await saveAddresses(next);
  },[addresses,saveAddresses]);

  const updateAddress=useCallback(async(id,updates)=>{
    let next=addresses.map(
      a=>a.id===id?{...a,...updates}:a
    );

    const updated=next.find(a=>a.id===id);

    if(updated?.isDefault)
      next=next.map(a=>({...a,isDefault:a.id===id}));

    await saveAddresses(next);
  },[addresses,saveAddresses]);

  const deleteAddress=useCallback(async id=>{
    const deleted=addresses.find(a=>a.id===id);
    let next=addresses.filter(a=>a.id!==id);

    if(deleted?.isDefault&&next.length)
      next=next.map((a,i)=>({...a,isDefault:i===0}));

    await saveAddresses(next);
  },[addresses,saveAddresses]);

  const setDefaultAddressById=useCallback(
    id=>saveAddresses(
      addresses.map(a=>({...a,isDefault:a.id===id}))
    ),
    [addresses,saveAddresses]
  );

  // ======================================================
  // PRICING / QR
  // ======================================================

  const savePricing=useCallback(
    next=>saveShopProfile({
      pricing:{
        ...INITIAL_PRICING,
        ...(next||{})
      }
    }),
    [saveShopProfile]
  );

  const saveQrUrl=useCallback(
    url=>saveShopProfile({
      qrUrl:String(url||'').trim()
    }),
    [saveShopProfile]
  );

  // ======================================================
  // JOB STATUS
  // ======================================================

  const markJob=useCallback(async(id,status,amount=0)=>{
    if(!id||!serialNumber)return;

    const nextStatus=
      status==='done'||status==='completed'?'done':
      status==='cancel'||status==='cancelled'?'cancelled':
      status==='expired'?'expired':
      status==='pending'?'pending':
      status;

    const key=`${id}:${nextStatus}`;

    if(updatingJobs.current.has(key))return;
    updatingJobs.current.add(key);

    try{
      if(nextStatus==='done'||nextStatus==='cancelled'){
        const rpc=nextStatus==='done'
          ?'complete_print_job'
          :'cancel_print_job';

        const params=nextStatus==='done'
          ?{
              p_job_id:id,
              p_serial_number:serialNumber,
              p_amount:amount
            }
          :{
              p_job_id:id,
              p_serial_number:serialNumber
            };

        const {data,error}=await supabase.rpc(rpc,params);

        if(error){
          if(
            error.code==='P0001'||
            /no longer pending/i.test(error.message||'')
          ){
            knownJobIds.current.delete(id);

            setJobs(prev=>prev.map(j=>j.id===id?{
              ...j,
              status:nextStatus,
              files:[]
            }:j));

            if(nextStatus==='done'){
              await loadTodayPrints();
              await loadTodayRevenue();
            }

            return;
          }

          throw error;
        }

        const storagePaths=(data||[])
          .map(x=>typeof x==='string'?x:x?.storage_path)
          .filter(Boolean);

        if(storagePaths.length){
          const {error:storageError}=await supabase.storage
            .from(BUCKET)
            .remove(storagePaths);

          if(storageError)throw storageError;
        }

        if(nextStatus==='done'){
          await loadTodayPrints();
          await loadTodayRevenue();
        }

        knownJobIds.current.delete(id);

        setJobs(prev=>prev.map(j=>j.id===id?{
          ...j,
          status:nextStatus,
          files:[]
        }:j));

        showToast(
          nextStatus==='done'
            ?'Job printed successfully'
            :'Job cancelled successfully'
        );

        return;
      }

      if(nextStatus==='pending'){
        const {error}=await supabase.rpc('restore_print_job',{
          p_job_id:id,
          p_serial_number:serialNumber
        });

        if(error){
          if(
            error.code==='P0001'||
            /no longer pending/i.test(error.message||'')
          ){
            knownJobIds.current.add(id);
            return;
          }

          throw error;
        }

        knownJobIds.current.add(id);

        setJobs(prev=>prev.map(j=>j.id===id?{
          ...j,
          status:'pending'
        }:j));

        showToast('Job restored');
        return;
      }

      if(nextStatus==='expired'){
        knownJobIds.current.delete(id);

        setJobs(prev=>prev.map(j=>j.id===id?{
          ...j,
          status:'expired',
          files:[]
        }:j));

        return;
      }

      setJobs(prev=>prev.map(j=>j.id===id?{
        ...j,
        status:nextStatus
      }:j));

      showToast('Job updated');
    }catch(error){
      if(
        error?.code==='P0001'||
        /no longer pending/i.test(error?.message||'')
      ){
        knownJobIds.current.delete(id);

        setJobs(prev=>prev.map(j=>j.id===id?{
          ...j,
          status:nextStatus,
          files:
            nextStatus==='done'||nextStatus==='cancelled'
              ?[]
              :j.files
        }:j));

        if(nextStatus==='done'){
          await loadTodayPrints();
          await loadTodayRevenue();
        }

        return;
      }

      showToast(error?.message||'Failed to update job');
    }finally{
      updatingJobs.current.delete(key);
    }
  },[serialNumber,loadTodayPrints,loadTodayRevenue]);

  // ======================================================
  // CLEAR ALL QUEUE
  // ======================================================

  const clearAllJobs=useCallback(async()=>{
    const serial=serialNumber.trim();
    if(!serial)return false;

    try{
      const {data,error}=await supabase.rpc('clear_shop_queue',{
        p_serial_number:serial
      });

      if(error)throw error;

      const storagePaths=(data||[])
        .map(x=>typeof x==='string'?x:x?.storage_path)
        .filter(Boolean);

      if(storagePaths.length){
        const {error:storageError}=await supabase.storage
          .from(BUCKET)
          .remove(storagePaths);

        if(storageError)throw storageError;
      }

      knownJobIds.current=new Set();
      queueInitialized.current=true;
      setJobs([]);

      showToast('Queue cleared successfully');
      return true;
    }catch(error){
      showToast(error?.message||'Failed to clear queue');
      return false;
    }
  },[serialNumber]);

  // ======================================================
  // LEGACY LOCAL ADD JOB
  // ======================================================

  const addJob=useCallback(jobData=>{
    const job={
      id:`local_${Date.now()}`,
      name:jobData.name||'Customer',
      notes:jobData.notes||'',
      files:Array.isArray(jobData.files)?jobData.files:[],
      status:'pending',
      time:nowTime(),
      timestamp:Date.now()
    };

    setJobs(prev=>[job,...prev]);
    showAlert('New print request received');
  },[]);

  // ======================================================
  // NOTIFICATIONS
  // ======================================================

  const showToast=useCallback(msg=>{
    setToast({msg,show:true});
    clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(
      ()=>setToast(v=>({...v,show:false})),
      2400
    );
  },[]);

  const showAlert=useCallback(msg=>{
    setAlert({msg,show:true});
    clearTimeout(alertTimer.current);
    alertTimer.current=setTimeout(
      ()=>setAlert(v=>({...v,show:false})),
      4200
    );
  },[]);

  const hideAlert=useCallback(
    ()=>setAlert(v=>({...v,show:false})),
    []
  );

  // ======================================================
  // CONTEXT
  // ======================================================

  const value={
    loading,
    shopId,
    serialNumber,
    ownerName,
    setOwnerName,
    shopName,
    setShopName,
    phone,
    setPhone,
    email,
    setEmail,
    qrUrl,
    setQrUrl,
    shopUrl,
    setShopUrl,
    saveShopProfile,

    // ADDRESSES
    addresses,
    setAddresses,
    defaultAddress,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddressById,
    saveAddresses,

    // SHOP
    pricing,
    setPricing,
    savePricing,
    saveQrUrl,

    // CUSTOMER ORDERS
    orders,
    loadOrders,
    placeShopOrder,

    // PRINT QUEUE
    jobs,
    todayPrints,
    todayRevenue,
    setJobs,
    markJob,
    clearAllJobs,
    addJob,

    // NOTIFICATIONS
    toast,
    showToast,
    alert,
    showAlert,
    hideAlert
  };

  return(
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

function formatSize(bytes=0){
  if(bytes<1024)return`${bytes} B`;
  if(bytes<1048576)return`${(bytes/1024).toFixed(0)} KB`;
  return`${(bytes/1048576).toFixed(1)} MB`;
}

export function useApp(){
  const context=useContext(AppContext);
  if(!context)
    throw new Error('useApp must be used inside AppProvider');
  return context;
}