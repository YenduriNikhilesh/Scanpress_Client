import {useEffect,useMemo,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {
  ArrowLeft,MapPin,ShoppingBag,Receipt,CreditCard,ShieldCheck,
  Trash2,Plus,Minus,Navigation,Check,Package,CalendarDays,Truck
} from 'lucide-react';
import {useApp} from '../services/AppContext';
import '../styles/checkout.css';

const EMPTY_ADDRESS={
  type:'Home',name:'',phone:'',line1:'',line2:'',
  city:'',state:'',pincode:'',isDefault:false
};

export default function Checkout(){
  const navigate=useNavigate();
  const {state}=useLocation();
  const {addresses,defaultAddress,addAddress,placeShopOrder}=useApp();

 const [items,setItems]=useState(state?.cart||[]);
const [payment,setPayment]=useState('cod');
const [placed,setPlaced]=useState(false);
const [placing,setPlacing]=useState(false);

useEffect(()=>{
  const top=()=>{
    window.scrollTo({top:0,left:0,behavior:'instant'});
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
  };
  top();
  requestAnimationFrame(top);
},[placed]);

const [order,setOrder]=useState(null);
  const [showAddresses,setShowAddresses]=useState(false);
  const [addingAddress,setAddingAddress]=useState(false);
  const [selectedAddressId,setSelectedAddressId]=useState(
    defaultAddress?.id||addresses[0]?.id||''
  );

  const [form,setForm]=useState({
    name:'',phone:'',address:'',city:'',state:'',pincode:''
  });

  const [newAddress,setNewAddress]=useState(EMPTY_ADDRESS);

  const selectedAddress=
    addresses.find(a=>a.id===selectedAddressId)||
    defaultAddress||
    addresses[0]||
    null;

  const subtotal=useMemo(
    ()=>items.reduce(
      (sum,item)=>sum+Number(item.price||0)*Number(item.quantity||1),0
    ),
    [items]
  );

  const totalItems=useMemo(
    ()=>items.reduce((sum,item)=>sum+Number(item.quantity||1),0),
    [items]
  );

  const updateQty=(id,change)=>{
    setItems(prev=>prev.map(item=>
      item.id===id
        ?{...item,quantity:Math.max(1,Number(item.quantity||1)+change)}
        :item
    ));
  };

  const removeItem=id=>setItems(prev=>prev.filter(item=>item.id!==id));

  const selectAddress=address=>{
    setSelectedAddressId(address.id);
    setShowAddresses(false);
    setAddingAddress(false);
    setForm({
      name:address.name||'',
      phone:address.phone||'',
      address:address.line1||address.address||'',
      city:address.city||'',
      state:address.state||'',
      pincode:address.pincode||address.pin||''
    });
  };

  const useDefaultAddress=()=>{
    if(selectedAddress)selectAddress(selectedAddress);
  };

  const updateForm=e=>
    setForm(prev=>({...prev,[e.target.name]:e.target.value}));

  const updateNewAddress=e=>
    setNewAddress(prev=>({...prev,[e.target.name]:e.target.value}));

  const openNewAddress=()=>{
    setAddingAddress(true);
    setShowAddresses(false);
    setNewAddress({
      ...EMPTY_ADDRESS,
      isDefault:addresses.length===0
    });
  };

  const saveNewAddress=async()=>{
    if(
      !newAddress.name.trim()||
      !newAddress.phone.trim()||
      !newAddress.line1.trim()||
      !newAddress.city.trim()||
      !newAddress.state.trim()||
      !newAddress.pincode.trim()
    )return;

    try{
      const address={
        ...newAddress,
        id:`address_${Date.now()}`,
        icon:newAddress.type==='Office'?'🏢':
          newAddress.type==='Other'?'📍':'🏠'
      };

      await addAddress(address);
      setSelectedAddressId(address.id);
      setForm({
        name:address.name,
        phone:address.phone,
        address:address.line1,
        city:address.city,
        state:address.state,
        pincode:address.pincode
      });
      setAddingAddress(false);
      setShowAddresses(false);
    }catch(error){
      console.error('Address save failed:',error);
    }
  };

  // ======================================================
  // PLACE REAL ORDER
  // ======================================================

  const placeOrder=async e=>{
    e.preventDefault();

    if(placing)return;

    const address=selectedAddress||{
      name:form.name,
      phone:form.phone,
      line1:form.address,
      city:form.city,
      state:form.state,
      pincode:form.pincode
    };

    if(
      !items.length||
      !address?.name||
      !address?.phone||
      !(address?.line1||address?.address)||
      !address?.city||
      !address?.state||
      !(address?.pincode||address?.pin)
    )return;

    try{
      setPlacing(true);

      const result=await placeShopOrder({
        items,
        address,
        payment,
        subtotal
      });

      // RPC may return the UUID directly or inside an object.
      const orderData=Array.isArray(result)?result[0]:result;
      const orderId=
        orderData?.order_id||
        orderData?.id||
        orderData?.shop_order_id||
        result;

      setOrder({
        id:orderId,
        created_at:new Date().toISOString(),
        total_amount:subtotal,
        payment_method:payment,
        item_count:totalItems
      });

      setPlaced(true);
    }catch(error){
      console.error('Order placement failed:',error);
      alert(error?.message||'Unable to place order. Please try again.');
    }finally{
      setPlacing(false);
    }
  };

  // ======================================================
  // ORDER SUCCESS
  // ======================================================

  if(placed){
    return(
      <div className="checkout-page">
        <header className="checkout-topbar">
          <button onClick={()=>navigate('/shop')} aria-label="Back">
            <ArrowLeft size={20}/>
          </button>
          <h1><span>Print</span>Shop</h1>
          <div className="topbar-space"/>
        </header>

        <main className="success-page">
          <section className="success-card">
            <div className="success-icon">
              <Check size={42}/>
            </div>

            <h2>Order Placed!</h2>
            <p>Your order has been successfully placed.</p>

            <div className="success-order-id">
              <small>Order ID</small>
              <strong>{order?.id||'Order Confirmed'}</strong>
            </div>

            <div className="order-info-card">
              <div>
                <CalendarDays/>
                <span>
                  Order Date
                  <strong>
                    {new Date(
                      order?.created_at||Date.now()
                    ).toLocaleString()}
                  </strong>
                </span>
              </div>

              <div>
                <Package/>
                <span>
                  Items
                  <strong>
                    {totalItems} {totalItems===1?'Item':'Items'}
                  </strong>
                </span>
              </div>

              <div>
                <Receipt/>
                <span>
                  Total Amount
                  <strong>
                    ₹{subtotal.toLocaleString('en-IN')}
                  </strong>
                </span>
              </div>

              <div>
                <CreditCard/>
                <span>
                  Payment Method
                  <strong>
                    {payment==='cod'
                      ?'Cash on Delivery'
                      :'Online Payment'}
                  </strong>
                </span>
              </div>

              <div>
                <Truck/>
                <span>
                  Delivery
                  <strong>3–5 Business Days</strong>
                </span>
              </div>
            </div>
          </section>

          <section className="next-card">
            <div className="next-icon">📦</div>

            <div>
              <h3>What happens next?</h3>
              <p><Check size={14}/> We have received your order</p>
              <p><Check size={14}/> Your order will be confirmed soon</p>
              <p><Check size={14}/> We will notify you when it's shipped</p>
              <p><Check size={14}/> You can track your order anytime</p>
            </div>
          </section>

          <section className="thanks-card">
            <div>🏷️</div>

            <div>
              <strong>
                Thank you for shopping with<br/>
                ScanPress Shop!
              </strong>
              <p>We appreciate your trust in us.</p>
            </div>
          </section>

          <button
            className="primary-btn"
            onClick={()=>navigate('/orders')}
          >
            View My Orders
          </button>

          <button
            className="secondary-btn"
            onClick={()=>navigate('/shop')}
          >
            Continue Shopping
          </button>

          <div className="checkout-secure">
            <ShieldCheck size={14}/>
            Secure transactions · Fast delivery · ScanPress Shop
          </div>
        </main>
      </div>
    );
  }

  // ======================================================
  // CHECKOUT
  // ======================================================

  return(
    <div className="checkout-page">
      <header className="checkout-topbar">
        <button onClick={()=>navigate('/shop')} aria-label="Back">
          <ArrowLeft size={20}/>
        </button>

        <h1><span>Print</span>Shop</h1>
        <div className="topbar-space"/>
      </header>

      <main className="checkout-content">
        <div className="checkout-heading">
          <h2>Checkout</h2>
        </div>

        <form onSubmit={placeOrder}>

          {/* ==================================================
              DELIVERY DETAILS
          ================================================== */}

          <section className="checkout-card">
            <div className="section-title">
              <MapPin/>

              <div>
                <h3>Delivery Details</h3>
                <p>Where should we deliver your order?</p>
              </div>
            </div>

            {selectedAddress&&!addingAddress&&(
              <div style={{
                marginBottom:16,
                padding:14,
                border:'1px solid #f0d7c8',
                borderRadius:12,
                background:'#fffaf7'
              }}>
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'flex-start',
                  gap:10
                }}>
                  <div>
                    <div style={{
                      fontSize:12,
                      fontWeight:700,
                      color:'#e64b00',
                      marginBottom:6
                    }}>
                      {selectedAddress.type||'Delivery Address'}
                      {selectedAddress.isDefault&&' · DEFAULT'}
                    </div>

                    <strong style={{fontSize:14}}>
                      {selectedAddress.name}
                    </strong>

                    <div style={{
                      marginTop:5,
                      fontSize:12,
                      lineHeight:1.6,
                      color:'#777'
                    }}>
                      {selectedAddress.line1||selectedAddress.address}

                      {(selectedAddress.line2||selectedAddress.area)&&(
                        <>
                          <br/>
                          {selectedAddress.line2||selectedAddress.area}
                        </>
                      )}

                      <br/>
                      {selectedAddress.city},{' '}
                      {selectedAddress.state} —{' '}
                      {selectedAddress.pincode||selectedAddress.pin}

                      <br/>
                      Phone: {selectedAddress.phone}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={()=>setShowAddresses(true)}
                    style={{
                      border:0,
                      background:'transparent',
                      color:'#e64b00',
                      fontWeight:700,
                      fontSize:12,
                      cursor:'pointer',
                      whiteSpace:'nowrap'
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {showAddresses&&!addingAddress&&(
              <div style={{
                marginBottom:16,
                padding:12,
                border:'1px solid #eadfd8',
                borderRadius:12,
                background:'#fff'
              }}>
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  marginBottom:10
                }}>
                  <strong style={{fontSize:14}}>
                    Saved Addresses
                  </strong>

                  <button
                    type="button"
                    onClick={()=>setShowAddresses(false)}
                    style={{
                      border:0,
                      background:'transparent',
                      color:'#888',
                      cursor:'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {addresses.length?addresses.map(address=>(
                  <button
                    type="button"
                    key={address.id}
                    onClick={()=>selectAddress(address)}
                    style={{
                      width:'100%',
                      textAlign:'left',
                      padding:12,
                      marginBottom:8,
                      border:'1px solid',
                      borderColor:
                        selectedAddress?.id===address.id
                          ?'#e64b00'
                          :'#eadfd8',
                      borderRadius:10,
                      background:
                        selectedAddress?.id===address.id
                          ?'#fff6f0'
                          :'#fff',
                      cursor:'pointer'
                    }}
                  >
                    <strong style={{fontSize:13}}>
                      {address.icon||'🏠'}{' '}
                      {address.type||'Address'}

                      {address.isDefault&&(
                        <span style={{
                          color:'#e64b00',
                          fontSize:10
                        }}>
                          {' · DEFAULT'}
                        </span>
                      )}
                    </strong>

                    <div style={{
                      marginTop:4,
                      fontSize:11,
                      lineHeight:1.5,
                      color:'#777'
                    }}>
                      {address.name} · {address.phone}<br/>
                      {address.line1||address.address},{' '}
                      {address.city}, {address.state} —{' '}
                      {address.pincode||address.pin}
                    </div>
                  </button>
                )):(
                  <div style={{
                    padding:'12px 4px',
                    fontSize:12,
                    color:'#999'
                  }}>
                    No saved addresses yet.
                  </div>
                )}

                <button
                  type="button"
                  onClick={openNewAddress}
                  style={{
                    width:'100%',
                    padding:11,
                    border:'1px dashed #e64b00',
                    borderRadius:9,
                    background:'#fff7f2',
                    color:'#e64b00',
                    fontWeight:700,
                    cursor:'pointer'
                  }}
                >
                  + Add New Address
                </button>
              </div>
            )}

            {!addresses.length&&!addingAddress&&(
              <button
                type="button"
                onClick={openNewAddress}
                style={{
                  width:'100%',
                  marginBottom:16,
                  padding:12,
                  border:'1px dashed #e64b00',
                  borderRadius:10,
                  background:'#fff7f2',
                  color:'#e64b00',
                  fontWeight:700,
                  cursor:'pointer'
                }}
              >
                + Add New Address
              </button>
            )}

            {addingAddress?(
              <div style={{
                padding:14,
                border:'1px solid #eadfd8',
                borderRadius:12,
                background:'#fff'
              }}>
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  marginBottom:14
                }}>
                  <strong>Add New Address</strong>

                  <button
                    type="button"
                    onClick={()=>setAddingAddress(false)}
                    style={{
                      border:0,
                      background:'transparent',
                      color:'#888',
                      cursor:'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Address Type</span>
                    <select
                      name="type"
                      value={newAddress.type}
                      onChange={updateNewAddress}
                    >
                      <option>Home</option>
                      <option>Office</option>
                      <option>Other</option>
                    </select>
                  </label>

                  <label>
                    <span>Full Name</span>
                    <input
                      name="name"
                      value={newAddress.name}
                      onChange={updateNewAddress}
                      placeholder="Enter your name"
                    />
                  </label>

                  <label>
                    <span>Mobile Number</span>
                    <input
                      name="phone"
                      value={newAddress.phone}
                      onChange={updateNewAddress}
                      placeholder="Enter mobile number"
                      inputMode="tel"
                    />
                  </label>

                  <label className="full">
                    <span>House / Street / Building</span>
                    <input
                      name="line1"
                      value={newAddress.line1}
                      onChange={updateNewAddress}
                      placeholder="Enter complete address"
                    />
                  </label>

                  <label className="full">
                    <span>Area / Landmark</span>
                    <input
                      name="line2"
                      value={newAddress.line2}
                      onChange={updateNewAddress}
                      placeholder="Area or landmark"
                    />
                  </label>

                  <label>
                    <span>City</span>
                    <input
                      name="city"
                      value={newAddress.city}
                      onChange={updateNewAddress}
                      placeholder="City"
                    />
                  </label>

                  <label>
                    <span>State</span>
                    <input
                      name="state"
                      value={newAddress.state}
                      onChange={updateNewAddress}
                      placeholder="State"
                    />
                  </label>

                  <label>
                    <span>PIN Code</span>
                    <input
                      name="pincode"
                      value={newAddress.pincode}
                      onChange={updateNewAddress}
                      placeholder="PIN code"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={saveNewAddress}
                  style={{
                    width:'100%',
                    marginTop:14,
                    padding:12,
                    border:0,
                    borderRadius:9,
                    background:'#e64b00',
                    color:'#fff',
                    fontWeight:700,
                    cursor:'pointer'
                  }}
                >
                  Save & Use This Address
                </button>
              </div>
            ):!selectedAddress&&(
              <div className="form-grid">
                <label>
                  <span>Full Name</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateForm}
                    placeholder="Enter your name"
                    required
                  />
                </label>

                <label>
                  <span>Mobile Number</span>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={updateForm}
                    placeholder="Enter mobile number"
                    inputMode="tel"
                    required
                  />
                </label>

                <label className="full">
                  <span>House / Street / Building</span>
                  <input
                    name="address"
                    value={form.address}
                    onChange={updateForm}
                    placeholder="Enter complete address"
                    required
                  />
                </label>

                <label>
                  <span>City</span>
                  <input
                    name="city"
                    value={form.city}
                    onChange={updateForm}
                    placeholder="City"
                    required
                  />
                </label>

                <label>
                  <span>State</span>
                  <input
                    name="state"
                    value={form.state}
                    onChange={updateForm}
                    placeholder="State"
                    required
                  />
                </label>

                <label>
                  <span>PIN Code</span>
                  <input
                    name="pincode"
                    value={form.pincode}
                    onChange={updateForm}
                    placeholder="PIN code"
                    inputMode="numeric"
                    required
                  />
                </label>

                
              </div>
            )}

            
        
          </section>

          {/* ==================================================
              ORDER SUMMARY
          ================================================== */}

          <section className="checkout-card">
            <div className="section-title">
              <ShoppingBag/>

              <div>
                <h3>
                  Order Summary ({totalItems}{' '}
                  {totalItems===1?'item':'items'})
                </h3>
              </div>
            </div>

            {!items.length?(
              <div className="empty-checkout">
                <Package size={34}/>
                <p>Your cart is empty</p>

                <button
                  type="button"
                  onClick={()=>navigate('/shop')}
                >
                  Browse Products
                </button>
              </div>
            ):(
              <div className="checkout-items">
                {items.map(item=>{
                  const quantity=Number(item.quantity||1);
                  const price=Number(item.price||0);

                  return(
                    <div className="checkout-item" key={item.id}>
                      <div className="item-image">
                        {item.image_url
                          ?<img src={item.image_url} alt={item.name}/>
                          :<span>{item.emoji||'📦'}</span>}
                      </div>

                      <div className="item-details">
                        <h4>{item.name}</h4>
                        <strong>
                          ₹{price.toLocaleString('en-IN')}
                        </strong>

                        <div className="quantity">
                          <button
                            type="button"
                            onClick={()=>updateQty(item.id,-1)}
                          >
                            <Minus size={13}/>
                          </button>

                          <span>{quantity}</span>

                          <button
                            type="button"
                            onClick={()=>updateQty(item.id,1)}
                          >
                            <Plus size={13}/>
                          </button>
                        </div>
                      </div>

                      <div className="item-right">
                        <button
                          type="button"
                          onClick={()=>removeItem(item.id)}
                          aria-label="Remove"
                        >
                          <Trash2 size={15}/>
                        </button>

                        <strong>
                          ₹{(price*quantity).toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ==================================================
              PRICE + PAYMENT
          ================================================== */}

          {!!items.length&&(
            <>
              <section className="checkout-card price-card">
                <div className="section-title">
                  <Receipt/>
                  <h3>Price Details</h3>
                </div>

                <div className="price-row">
                  <span>Subtotal ({totalItems} items)</span>
                  <strong>
                    ₹{subtotal.toLocaleString('en-IN')}
                  </strong>
                </div>

                <div className="price-row">
                  <span>Delivery Charges</span>
                  <strong className="free">FREE</strong>
                </div>

                <div className="price-total">
                  <span>Total Amount</span>
                  <strong>
                    ₹{subtotal.toLocaleString('en-IN')}
                  </strong>
                </div>
              </section>

              <section className="checkout-card">
                <div className="section-title">
                  <CreditCard/>
                  <h3>Payment Method</h3>
                </div>

                <button
                  type="button"
                  className={`payment-option ${
                    payment==='cod'?'selected':''
                  }`}
                  onClick={()=>setPayment('cod')}
                >
                  <span className="radio">
                    {payment==='cod'&&<i/>}
                  </span>

                  <span className="payment-icon">💵</span>

                  <span>
                    <strong>Cash on Delivery</strong>
                    <small>
                      Pay when you receive your order
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  className="payment-option disabled"
                  disabled
                >
                  <span className="radio"/>
                  <span className="payment-icon">💳</span>

                  <span>
                    <strong>Online Payment</strong>
                    <small>
                      UPI, Cards, Net Banking (Coming Soon)
                    </small>
                  </span>
                </button>
              </section>

              <div className="secure-note">
                <ShieldCheck size={15}/>
                Your order is safe and secure with ScanPress
              </div>

              <button
                className="place-order-btn"
                type="submit"
                disabled={placing}
              >
                {placing
                  ?'Placing Order...'
                  :'Place Order'}
                {!placing&&<span>→</span>}
                {!placing&&` ₹${subtotal.toLocaleString('en-IN')}`}
              </button>

              <div className="checkout-secure">
                🔒 Secure checkout · Powered by ScanPress
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}