import React,{useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useApp} from '../services/AppContext';
import {supabase} from '../services/supabase';
import '../styles/myorders.css';
const EMPTY_ADDRESS={
  type:'Home',name:'',phone:'',address:'',area:'',
  city:'',state:'',pin:'',isDefault:false
};
const money=value=>`₹${Number(value||0).toLocaleString('en-IN')}`;
const Icon=({icon,alt})=>
  /^https?:\/\//.test(icon||'')
    ?<img src={icon} alt={alt||''}/>
    :<>{icon||'📦'}</>;
const getItems=order=>{
  const items=order?.items||order?.order_items||order?.shop_order_items||[];
  if(Array.isArray(items)&&items.length)return items;
  if(order?.product||order?.product_name)return[{
    id:order.item_id||order.product_id,
    product_id:order.product_id,
    product:order.product||order.product_name,
    name:order.product||order.product_name,
    icon:order.icon||order.emoji||order.image||order.image_url,
    price:Number(order.price||order.unit_price||0),
    quantity:Number(order.quantity||1)
  }];
  return[];
};
const normalizeItem=(item,productMap)=>{
  const match=productMap?.get(item.product_id||item.id)||productMap?.get(item.name||item.product_name)||{};
  return{
    id:item.id||item.product_id||item.item_id,
    name:item.name||item.product_name||match.name||'Product',
    icon:item.icon||item.emoji||item.image_url||match.image_url||match.emoji||'📦',
    price:Number(item.price??item.unit_price??item.product_price??0),
    quantity:Number(item.quantity||item.qty||1)
  };
};
const getOrderItems=(order,productMap)=>getItems(order).map(item=>normalizeItem(item,productMap));
const getTotal=(order,items)=>Number(
  order?.total_amount??
  order?.total??
  order?.grand_total??
  order?.line_total??
  items.reduce((sum,item)=>sum+item.price*item.quantity,0)
);
const getStatus=order=>{
  const value=String(order?.status||order?.order_status||'Processing').toLowerCase();
  if(value.includes('deliver'))return'Delivered';
  if(value.includes('out'))return'Out for Delivery';
  if(value.includes('ship'))return'Shipped';
  if(value.includes('confirm'))return'Confirmed';
  return'Processing';
};
const getRawDate=order=>order?.created_at||order?.createdAt||order?.date||null;
const formatDate=date=>date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const getDate=order=>{
  const value=getRawDate(order);
  if(!value)return'—';
  const date=new Date(value);
  return Number.isNaN(date.getTime())
    ?String(value)
    :formatDate(date);
};
const getExpectedDelivery=order=>{
  const value=getRawDate(order);
  if(!value)return'—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return'—';
  const delivery=new Date(date);
  delivery.setDate(delivery.getDate()+4);
  return formatDate(delivery);
};
const shortId=id=>{
  if(!id)return'';
  const str=String(id);
  return str.length>10?str.slice(0,8):str;
};
const getTimeline=status=>{
  const steps=['Processing','Confirmed','Shipped','Out for Delivery','Delivered'];
  const index=steps.indexOf(status);
  return steps.map((label,i)=>({label,active:i<=index}));
};
export default function MyOrders(){
  const navigate=useNavigate();
  const {
    orders=[],
    addresses=[],
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddressById,
    showToast
  }=useApp();
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('All');
  const [selectedOrder,setSelectedOrder]=useState(null);
  const [addressMode,setAddressMode]=useState(null);
  const [editingAddressId,setEditingAddressId]=useState(null);
  const [addressForm,setAddressForm]=useState(EMPTY_ADDRESS);
  const [saving,setSaving]=useState(false);
  const [deleteAddressId,setDeleteAddressId]=useState(null);
  const [products,setProducts]=useState([]);
  useEffect(()=>{
    window.scrollTo(0,0);
    document.scrollingElement?.scrollTo(0,0);
    document.body.scrollTop=0;
    document.documentElement.scrollTop=0;
  },[selectedOrder,addressMode]);
  useEffect(()=>{
    supabase.from('public_products').select('*').then(({data})=>setProducts(data||[]));
  },[]);
  const productMap=useMemo(()=>{
    const map=new Map();
    products.forEach(p=>{
      if(p.id!=null)map.set(p.id,p);
      if(p.name)map.set(p.name,p);
    });
    return map;
  },[products]);
  const normalizedOrders=useMemo(()=>(
    (Array.isArray(orders)?orders:[]).map(order=>{
      const items=getOrderItems(order,productMap);
      return{
        ...order,
        id:order.id||order.order_id||order.orderId,
        items,
        status:getStatus(order),
        total:getTotal(order,items),
        date:getDate(order),
        expectedDelivery:getExpectedDelivery(order),
        addressId:order.address_id||order.addressId||null,
        payment:order.payment_method||order.payment||'Cash on Delivery'
      };
    })
  ),[orders,productMap]);
  const filteredOrders=useMemo(()=>{
    const query=search.trim().toLowerCase();
    return normalizedOrders.filter(order=>{
      const matchesFilter=filter==='All'||order.status===filter;
      const matchesSearch=!query||
        String(order.id||'').toLowerCase().includes(query)||
        order.status.toLowerCase().includes(query)||
        order.items.some(item=>item.name.toLowerCase().includes(query));
      return matchesFilter&&matchesSearch;
    });
  },[normalizedOrders,search,filter]);
  const selectedAddress=selectedOrder
    ?addresses.find(address=>address.id===selectedOrder.addressId)||
      selectedOrder.address||
      selectedOrder.delivery_address||
      null
    :null;
  const openOrder=order=>setSelectedOrder(order);
  const closeOrder=()=>setSelectedOrder(null);
  const openAddAddress=()=>{
    setAddressMode('add');
    setEditingAddressId(null);
    setAddressForm({
      ...EMPTY_ADDRESS,
      isDefault:addresses.length===0
    });
  };
  const openEditAddress=address=>{
    setAddressMode('edit');
    setEditingAddressId(address.id);
    setAddressForm({
      type:address.type||'Home',
      name:address.name||'',
      phone:address.phone||'',
      address:address.address||address.line1||'',
      area:address.area||address.line2||'',
      city:address.city||'',
      state:address.state||'',
      pin:address.pin||address.pincode||'',
      isDefault:!!address.isDefault
    });
  };
  const closeAddressForm=()=>{
    setAddressMode(null);
    setEditingAddressId(null);
    setAddressForm(EMPTY_ADDRESS);
  };
  const handleAddressChange=(field,value)=>{
    setAddressForm(previous=>({...previous,[field]:value}));
  };
  const saveAddress=async()=>{
    if(
      !addressForm.name.trim()||
      !addressForm.phone.trim()||
      !addressForm.address.trim()||
      !addressForm.city.trim()||
      !addressForm.state.trim()||
      !addressForm.pin.trim()
    ){
      showToast?.('Please fill all required address details.');
      return;
    }
    setSaving(true);
    try{
      const address={
        ...addressForm,
        icon:
          addressForm.type==='Office'
            ?'🏢'
            :addressForm.type==='Other'
              ?'📍'
              :'🏠'
      };
      if(editingAddressId){
        await updateAddress(editingAddressId,address);
        showToast?.('Address updated successfully');
      }else{
        await addAddress(address);
        showToast?.('Address saved successfully');
      }
      closeAddressForm();
    }catch(error){
      console.error('Address save failed:',error);
      showToast?.(error?.message||'Failed to save address.');
    }finally{
      setSaving(false);
    }
  };
  const requestDeleteAddress=id=>{
    setDeleteAddressId(id);
  };
  const cancelDeleteAddress=()=>{
    setDeleteAddressId(null);
  };
  const confirmDeleteAddress=async()=>{
    if(!deleteAddressId)return;
    try{
      await deleteAddress(deleteAddressId);
      showToast?.('Address deleted successfully');
    }catch(error){
      console.error('Address delete failed:',error);
      showToast?.(error?.message||'Failed to delete address.');
    }finally{
      setDeleteAddressId(null);
    }
  };
  const setDefaultAddress=async id=>{
    try{
      await setDefaultAddressById(id);
      showToast?.('Default address updated');
    }catch(error){
      console.error('Default address update failed:',error);
      showToast?.(error?.message||'Failed to update address.');
    }
  };
  const renderStatus=status=>(
    <span className={`order-status ${status.toLowerCase().replaceAll(' ','-')}`}>
      {status}
    </span>
  );
  const renderTimeline=status=>{
    const timeline=getTimeline(status);
    return(
      <div className="order-timeline">
        {timeline.map((step,index)=>(
          <div
            className={`timeline-step ${step.active?'active':''}`}
            key={step.label}
          >
            <div className="timeline-marker">
              {step.active?'✓':''}
            </div>
            <div className="timeline-label">
              {step.label}
            </div>
            {index<timeline.length-1&&(
              <div className="timeline-line"/>
            )}
          </div>
        ))}
      </div>
    );
  };
  const headerTitle=selectedOrder
    ?'Order Details'
    :addressMode==='add'
      ?'Add Address'
      :addressMode==='edit'
        ?'Edit Address'
        :'My Orders';
  const headerSubtitle=selectedOrder
    ?null
    :addressMode
      ?'Manage your delivery address'
      :'Your ScanPress purchases';
  return(
    <div className="myorders-page">
 {}
<div className="sh-topbar">
  <div className="sh-brand">
    <div className="sh-shop-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z"/>
        <path d="M8 8h8M8 12h8M8 16h5"/>
      </svg>
    </div>
    <div className="sh-brand-name">
      <span className="sh-logo-accent">My</span>
      <span className="sh-logo-normal">Orders</span>
    </div>
  </div>
  <button
    className="sh-cart-icon-btn"
    onClick={() => {
      if(selectedOrder) return closeOrder();
      if(addressMode) return closeAddressForm();
      navigate('/settings');
    }}
    aria-label="Go back"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="#d84e00" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M19 12H5"/>
      <path d="M12 19l-7-7 7-7"/>
    </svg>
  </button>
</div>
      {}
      {selectedOrder?(
        <main className="myorders-body">
          <section className="settings-section">
            <div className="settings-section-title">
              ORDER
            </div>
            <div className="order-detail-body">
              <div className="order-detail-summary">
                <div className="order-detail-icon">
                  {selectedOrder.items.length>1
                    ?'📦'
                    :<Icon icon={selectedOrder.items[0]?.icon} alt={selectedOrder.items[0]?.name}/>}
                </div>
                <div>
                  <strong>
                    {selectedOrder.items.length>1
                      ?`${selectedOrder.items.length} Items`
                      :selectedOrder.items[0]?.name||'Order'}
                  </strong>
                  <span>
                    {renderStatus(selectedOrder.status)}
                  </span>
                </div>
                <strong className="order-detail-total">
                  {money(selectedOrder.total)}
                </strong>
              </div>
              {selectedOrder.items.length>1&&<div className="order-info-block">
                <div className="order-info-label">Items in this Order</div>
                <div className="order-items-detail">
                  {selectedOrder.items.map((item,index)=><div className="order-detail-item" key={item.id||`${item.name}-${item.price}-${index}`}>
                    <div className="order-detail-item-icon"><Icon icon={item.icon} alt={item.name}/></div>
                    <div className="order-detail-item-info"><strong>{item.name}</strong><span>Qty: {item.quantity}</span></div>
                    <strong>{money(item.price*item.quantity)}</strong>
                  </div>)}
                </div>
              </div>}
              {}
              <div className="order-info-block">
                <div className="order-info-label">
                  Order Date
                </div>
                <div className="order-info-value">
                  {selectedOrder.date}
                </div>
              </div>
              <div className="order-info-block">
                <div className="order-info-label">Order ID</div>
                <div className="order-info-value">#{selectedOrder.id||'—'}</div>
              </div>
              {}
              <div className="order-info-block">
                <div className="order-info-label">
                  Expected Delivery
                </div>
                <div className="order-info-value expected-delivery-value">
                  🚚 {selectedOrder.expectedDelivery}
                </div>
              </div>
              {}
              <div className="order-info-block">
                <div className="order-info-label">
                  Payment
                </div>
                <div className="order-payment">
                  <span className="payment-check">
                    ✓
                  </span>
                  {selectedOrder.payment}
                </div>
              </div>
              {}
              <div className="order-info-block">
                <div className="order-info-label">
                  Total Amount
                </div>
                <div className="order-total-value">
                  {money(selectedOrder.total)}
                </div>
              </div>
              {}
              <div className="order-info-block">
                <div className="order-info-label">
                  Delivery Address
                </div>
                {selectedAddress?(
                  <div className="order-info-value">
                    <strong>
                      {selectedAddress.name}
                    </strong>
                    <br/>
                    {selectedAddress.address||selectedAddress.line1}
                    {(selectedAddress.area||selectedAddress.line2)&&(
                      <>
                        <br/>
                        {selectedAddress.area||selectedAddress.line2}
                      </>
                    )}
                    <br/>
                    {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pin||selectedAddress.pincode}
                    <br/>
                    Phone: {selectedAddress.phone}
                  </div>
                ):(
                  <div className="order-info-value">
                    {selectedOrder.delivery_address||
                      'No delivery address available.'}
                  </div>
                )}
              </div>
              {}
              <div className="order-info-block">
                <div className="order-status-heading">
                  <div className="order-info-label">
                    Order Status
                  </div>
                  {renderStatus(selectedOrder.status)}
                </div>
                {renderTimeline(selectedOrder.status)}
              </div>
            </div>
          </section>
        </main>
      ):addressMode?(
        <main className="myorders-body">
          <section className="settings-section">
            <div className="settings-section-title">
              ADDRESS DETAILS
            </div>
            {}
            <div className="settings-field">
              <label>
                ADDRESS TYPE
              </label>
              <div className="address-type-buttons">
                {['Home','Office','Other'].map(type=>(
                  <button
                    key={type}
                    type="button"
                    className={addressForm.type===type?'selected':''}
                    onClick={()=>
                      handleAddressChange('type',type)
                    }
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            {}
            {[
              ['name','FULL NAME *','Enter full name','text'],
              ['phone','PHONE NUMBER *','Enter phone number','tel'],
              ['address','HOUSE / FLAT / SHOP *','House / Flat / Shop number','text'],
              ['area','STREET / AREA','Street or area','text'],
              ['city','CITY *','Enter city','text'],
              ['state','STATE *','Enter state','text']
            ].map(([field,label,placeholder,type])=>(
              <div className="settings-field" key={field}>
                <label>
                  {label}
                </label>
                <input
                  type={type}
                  value={addressForm[field]}
                  placeholder={placeholder}
                  onChange={e=>
                    handleAddressChange(field,e.target.value)
                  }
                />
              </div>
            ))}
            {}
            <div className="settings-field">
              <label>
                PIN CODE *
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={addressForm.pin}
                placeholder="Enter PIN code"
                onChange={e=>
                  handleAddressChange(
                    'pin',
                    e.target.value.replace(/\D/g,'')
                  )
                }
              />
            </div>
            {}
            <label className="default-address-check">
              <input
                type="checkbox"
                checked={addressForm.isDefault}
                onChange={e=>
                  handleAddressChange(
                    'isDefault',
                    e.target.checked
                  )
                }
              />
              <span>
                Make this my default address
              </span>
            </label>
          </section>
          {}
          <div className="address-form-actions">
            <button
              type="button"
              className="password-cancel-btn"
              onClick={closeAddressForm}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={saveAddress}
              disabled={saving}
            >
              {saving
                ?'Saving...'
                :addressMode==='edit'
                  ?'Save Changes'
                  :'Save Address'}
            </button>
          </div>
        </main>
      ):(
        <main className="myorders-body">
          {}
          <section className="settings-section">
            {}
            <div className="orders-search">
              <span>
                🔍
              </span>
              <input
                type="search"
                value={search}
                placeholder="Search orders..."
                onChange={e=>setSearch(e.target.value)}
              />
            </div>
            {}
            <div className="order-filters">
              {[
                'All',
                'Processing',
                'Confirmed',
                'Shipped',
                'Out for Delivery',
                'Delivered'
              ].map(item=>(
                <button
                  key={item}
                  type="button"
                  className={`order-filter ${filter===item?'active':''}`}
                  onClick={()=>setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {}
            <div className="orders-list">
              {filteredOrders.length?(
                filteredOrders.map(order=>{
                  const itemCount=order.items.reduce(
                    (sum,item)=>sum+item.quantity,0
                  );
                  const multiple=order.items.length>1;
                  return(
                    <div
                      key={order.id}
                      className="order-card"
                    >
                      <div className="order-card-row">
                        {}
                        <button
                          type="button"
                          className={`order-product-icon ${multiple?'multi':''}`}
                          onClick={()=>openOrder(order)}
                          aria-label="View order"
                        >
                          {multiple
                            ?'📦'
                            :<Icon icon={order.items[0]?.icon} alt={order.items[0]?.name}/>}
                        </button>
                        {}
                        <div
                          className="order-card-main"
                          onClick={()=>openOrder(order)}
                        >
                          <div className="order-product-name">
                            {multiple
                              ?`${itemCount} Items`
                              :order.items[0]?.name||'Order'}
                          </div>
                          <div className="order-price">
                            {money(order.total)}
                          </div>
                          <div className="order-meta-row">
                            <span className="order-number">
                              Order #{shortId(order.id)}
                            </span>
                          </div>
                          <div className="order-delivery-row">
                            🚚 Expected {order.expectedDelivery}
                          </div>
                        </div>
                        {}
                        <div
                          className="order-card-right"
                          onClick={()=>openOrder(order)}
                        >
                          {renderStatus(order.status)}
                          <div className="order-date">
                            {order.date}
                          </div>
                          <div className="order-arrow" aria-hidden="true">
                            →
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ):(
                <div className="orders-empty">
                  <div className="orders-empty-icon">
                    📦
                  </div>
                  <div className="orders-empty-title">
                    No orders found
                  </div>
                  <div className="orders-empty-text">
                    Try another search or filter.
                  </div>
                </div>
              )}
            </div>
          </section>
          {}
          <section className="settings-section">
            <div className="settings-section-title">
              MY ADDRESSES
            </div>
            {}
            <div className="address-add-wrap">
              <button
                type="button"
                className="btn-primary"
                onClick={openAddAddress}
              >
                + Add New Address
              </button>
            </div>
            {!addresses.length?(
              <div className="orders-empty address-empty">
                <div className="orders-empty-icon">
                  🏠
                </div>
                <div className="orders-empty-title">
                  No saved addresses
                </div>
                <div className="orders-empty-text">
                  Add an address for faster checkout.
                </div>
              </div>
            ):(
              <div className="addresses-list">
                {addresses.map(address=>(
                  <div
                    className="saved-address"
                    key={address.id}
                  >
                    {}
                    <div className="saved-address-header">
                      <div className="saved-address-icon">
                        {address.icon||
                          (address.type==='Office'
                            ?'🏢'
                            :address.type==='Other'
                              ?'📍'
                              :'🏠')}
                      </div>
                      <div className="saved-address-title">
                        <div>
                          <strong>
                            {address.type||'Home'}
                          </strong>
                          {address.isDefault&&(
                            <span className="default-badge">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {}
                    <div className="saved-address-details">
                      <strong>
                        {address.name}
                      </strong>
                      <br/>
                      {address.address||address.line1}
                      {(address.area||address.line2)&&(
                        <>
                          <br/>
                          {address.area||address.line2}
                        </>
                      )}
                      <br/>
                      {address.city}, {address.state} — {address.pin||address.pincode}
                      <br/>
                      Phone: {address.phone}
                    </div>
                    {}
                    <div className="saved-address-actions">
                      {!address.isDefault&&(
                        <button
                          type="button"
                          className="make-default-btn"
                          onClick={()=>
                            setDefaultAddress(address.id)
                          }
                        >
                          ☆ Make Default
                        </button>
                      )}
                      <button
                        type="button"
                        className="edit-address-btn"
                        onClick={()=>
                          openEditAddress(address)
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="delete-address-btn"
                        onClick={()=>
                          requestDeleteAddress(address.id)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}
      {}
      {deleteAddressId&&(
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <button
              type="button"
              className="delete-modal-close"
              onClick={cancelDeleteAddress}
              aria-label="Close"
            >
              ×
            </button>
            <div className="delete-modal-icon">
              🏠
            </div>
            <h2>
              Delete Address?
            </h2>
            <p>
              This address will be removed from your saved addresses.
            </p>
            <div className="delete-modal-actions">
              <button
                type="button"
                className="delete-modal-cancel"
                onClick={cancelDeleteAddress}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-modal-confirm"
                onClick={confirmDeleteAddress}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}