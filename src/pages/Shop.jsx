// Shop.jsx — ScanPress ecommerce page
// Route: /shop

import {useState,useMemo,useCallback,useEffect,useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import BottomNav from './BottomNav';
import {supabase} from '../services/supabase';
import '../styles/shop.css';

const CATEGORIES=['All','Printers','Ink Bottles','Cartridges','Paper Bundles','Laminate Sheets','Accessories'];

const CATEGORY_ICONS={
  All:'🛍️',Printers:'🖨️','Ink Bottles':'🖊️',Cartridges:'🖋️',
  'Paper Bundles':'📄','Laminate Sheets':'✨',Accessories:'🔌'
};

const CATEGORY_VALUES={
  All:null,Printers:'printers','Ink Bottles':'ink',Cartridges:'cartridges',
  'Paper Bundles':'paper','Laminate Sheets':'laminate',Accessories:'accessories'
};

function normalizeCategory(category=''){
  const value=String(category).trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  if(['printer','printers'].includes(value))return'printers';
  if(['ink','inks','ink bottle','ink bottles'].includes(value))return'ink';
  if(['cartridge','cartridges','ink cartridge','ink cartridges'].includes(value))return'cartridges';
  if(['paper','papers','paper bundle','paper bundles','paper pack','paper packs','printing paper','printing papers'].includes(value))return'paper';
  if(['laminate','laminates','laminate sheet','laminate sheets','lamination sheet','lamination sheets','laminating sheet','laminating sheets','laminating pouch','laminating pouches'].includes(value))return'laminate';
  if(['accessory','accessories','equipment','equipments','other equipment','other equipments'].includes(value))return'accessories';
  return value;
}

const STOCK_LABEL={in_stock:'In Stock',low_stock:'Fast Selling',sold_out:'Sold Out'};

function DiscountBadge({price,original}){
  if(!original||original<=price)return null;
  return <span className="p-disc-badge">{Math.round(((original-price)/original)*100)}% OFF</span>;
}

function ProductVisual({src,emoji,photoClassName,emojiClassName,alt}){
  const[failed,setFailed]=useState(false);
  if(src&&!failed)return <img className={photoClassName} src={src} alt={alt} onError={()=>setFailed(true)}/>;
  return <span className={emojiClassName}>{emoji}</span>;
}

function ProductCard({product,onView,onAddToCart,onBuyNow}){
  const[justAdded,setJustAdded]=useState(false);
  const[pressed,setPressed]=useState(false);
  const soldOut=product.stock_status==='sold_out';

  function handleAdd(e){
    e.stopPropagation();
    if(soldOut)return;
    setJustAdded(true);
    onAddToCart(product,1);
    setTimeout(()=>setJustAdded(false),900);
  }

  return <div className={`p-card ${pressed?'is-pressed':''} ${soldOut?'is-soldout':''}`}
    onClick={()=>onView(product)}
    onPointerDown={()=>setPressed(true)}
    onPointerUp={()=>setPressed(false)}
    onPointerLeave={()=>setPressed(false)}>
    <div className="p-img-zone" style={{background:`${product.accent_color}12`}}>
      <ProductVisual src={product.image_url} emoji={product.emoji} photoClassName="p-card-photo" emojiClassName="p-card-emoji" alt={product.name}/>
      {!soldOut&&<DiscountBadge price={product.price} original={product.original_price}/>}
      {product.stock_status==='low_stock'&&<span className="p-low-stock-badge">Fast Selling</span>}
      {soldOut&&<span className="p-soldout-stamp">Sold Out</span>}
    </div>

    <div className="p-card-body">
      <div className="p-card-cat" style={{color:product.accent_color}}>{product.category}</div>
      <div className="p-card-name">{product.name}</div>
      <div className="p-card-desc">{product.short_desc}</div>

      <div className="p-price-row">
        <span className="p-price">₹{Number(product.price).toLocaleString('en-IN')}</span>
        {product.original_price>product.price&&<span className="p-slashed">₹{Number(product.original_price).toLocaleString('en-IN')}</span>}
      </div>

      <div className="p-card-btns">
        <button className={`p-add-btn ${justAdded?'is-added':''}`} disabled={soldOut} onClick={handleAdd}>
          {soldOut?'Unavailable':justAdded?'✓ Added':'+ Cart'}
        </button>
        <button className="p-buy-btn" disabled={soldOut} onClick={e=>{e.stopPropagation();if(!soldOut)onBuyNow(product,1)}}>
          {soldOut?'Sold out':'Buy Now'}
        </button>
      </div>
    </div>
  </div>;
}

function ProductModal({product,onClose,onAddToCart,onBuyNow,related,onViewRelated}){
  const[qty,setQty]=useState(1);
  const[added,setAdded]=useState(false);
  const soldOut=product.stock_status==='sold_out';

  useEffect(()=>{
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=''};
  },[]);

  function handleAdd(){
    if(soldOut)return;
    onAddToCart(product,qty);
    setAdded(true);
    setTimeout(()=>setAdded(false),1400);
  }

  const saving=(product.original_price||0)-product.price;

  return <div className="m-overlay" onClick={onClose}>
    <div className="m-sheet" onClick={e=>e.stopPropagation()}>
      <div className="m-handle-bar"/>

      <div className="m-header">
        <button className="m-close-btn" onClick={onClose}>✕</button>
        <span className="m-header-title">Product Details</span>
        <div style={{width:32}}/>
      </div>

      <div className="m-body">
        <div className="m-hero-zone" style={{background:`${product.accent_color}14`}}>
          <ProductVisual src={product.image_url} emoji={product.emoji} photoClassName="m-hero-photo" emojiClassName="m-hero-emoji" alt={product.name}/>
          {!soldOut&&product.original_price>product.price&&<span className="m-hero-disc-badge">{Math.round(((product.original_price-product.price)/product.original_price)*100)}% OFF</span>}
        </div>

        <div className="m-section">
          <div className="p-card-cat" style={{color:product.accent_color,marginBottom:6}}>{product.category}</div>
          <h2 className="m-prod-title">{product.name}</h2>
          <div className="m-rating-line">
            <span className={`m-stock-pill ${product.stock_status}`}>{STOCK_LABEL[product.stock_status]}</span>
          </div>
        </div>

        <div className="m-price-block">
          <span className="m-big-price">₹{Number(product.price).toLocaleString('en-IN')}</span>
          {product.original_price>product.price&&<>
            <span className="m-big-slash">₹{Number(product.original_price).toLocaleString('en-IN')}</span>
            <span className="m-save-pill">Save ₹{saving.toLocaleString('en-IN')}</span>
          </>}
        </div>

        {product.description&&<div className="m-section">
          <div className="m-section-head">Description</div>
          <p className="m-desc-text">{product.description}</p>
        </div>}

        {product.features?.length>0&&<div className="m-section">
          <div className="m-section-head">Key Features</div>
          <div className="m-feature-grid">
            {product.features.map((f,i)=><div key={i} className="m-feature-chip">
              <span className="m-feature-dot" style={{background:product.accent_color}}/>{f}
            </div>)}
          </div>
        </div>}

        <div className="m-section">
          <div className="m-section-head">Quantity</div>
          <div className="m-qty-row">
            <button className="m-qty-btn" disabled={soldOut} onClick={()=>setQty(q=>Math.max(1,q-1))}>−</button>
            <span className="m-qty-num">{qty}</span>
            <button className="m-qty-btn" disabled={soldOut} onClick={()=>setQty(q=>Math.min(99,q+1))}>+</button>
            <span className="m-qty-total">Total: <strong>₹{(product.price*qty).toLocaleString('en-IN')}</strong></span>
          </div>
        </div>

        <div className="m-action-row">
          <button className={`m-cart-btn ${added?'is-added':''}`} disabled={soldOut} onClick={handleAdd}>
            {soldOut?'Unavailable':added?'✓ Added to Cart!':'🛒  Add to Cart'}
          </button>
          <button className="m-buy-now-btn" disabled={soldOut} onClick={()=>{if(!soldOut)onBuyNow(product,qty)}}>
            {soldOut?'Sold out':'⚡ Buy Now'}
          </button>
        </div>

        {related.length>0&&<div className="m-section">
          <div className="m-section-head">You may also like</div>
          <div className="m-related-row">
            {related.map(rp=><div key={rp.id} className="m-rel-card" onClick={()=>onViewRelated(rp)}>
              <div className="m-rel-img" style={{background:`${rp.accent_color}14`}}>
                <ProductVisual src={rp.image_url} emoji={rp.emoji} photoClassName="m-rel-photo" emojiClassName="m-rel-emoji" alt={rp.name}/>
              </div>
              <div className="m-rel-name">{rp.name}</div>
              <div className="m-rel-price" style={{color:rp.accent_color}}>₹{Number(rp.price).toLocaleString('en-IN')}</div>
            </div>)}
          </div>
        </div>}

        <div style={{height:28}}/>
      </div>
    </div>
  </div>;
}

function CartDrawer({cart,onClose,onRemove,onChangeQty,onClear,onCheckout}){
  const subtotal=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const count=cart.reduce((s,i)=>s+i.qty,0);
  const delivery=subtotal>=499?0:49;
  const total=subtotal+delivery;

  useEffect(()=>{
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=''};
  },[]);

  return <div className="m-overlay" onClick={onClose}>
    <div className="m-sheet cart-sheet" onClick={e=>e.stopPropagation()}>
      <div className="m-handle-bar"/>
      <div className="m-header">
        <button className="m-close-btn" onClick={onClose}>✕</button>
        <span className="m-header-title">Cart ({count} item{count!==1?'s':''})</span>
        {cart.length>0&&<button onClick={onClear} className="m-clear-cart-btn">Clear</button>}
      </div>

      <div className="m-body">
        {cart.length===0?<div className="c-empty">
          <div className="c-empty-icon">🛒</div>
          <div className="c-empty-title">Your cart is empty</div>
          <div className="c-empty-sub">Browse products and add them here</div>
        </div>:<>
          {cart.map(item=><div key={item.id} className="c-item">
            <div className="c-item-img" style={{background:`${item.accent_color}14`}}>
              <ProductVisual src={item.image_url} emoji={item.emoji} photoClassName="c-item-photo" emojiClassName="c-item-emoji" alt={item.name}/>
            </div>
            <div className="c-item-info">
              <div className="c-item-name">{item.name}</div>
              <div className="c-item-price">₹{(item.price*item.qty).toLocaleString('en-IN')}</div>
              <div className="c-qty-mini">
                <button className="c-q-btn-mini" onClick={()=>onChangeQty(item.id,item.qty-1)}>−</button>
                <span className="c-q-val-mini">{item.qty}</span>
                <button className="c-q-btn-mini" onClick={()=>onChangeQty(item.id,item.qty+1)}>+</button>
              </div>
            </div>
            <button className="c-remove-btn" onClick={()=>onRemove(item.id)}>🗑</button>
          </div>)}

          <div className="c-summary-box">
            <div className="c-summary-row"><span className="c-summary-label">Subtotal ({count} items)</span><span className="c-summary-val">₹{subtotal.toLocaleString('en-IN')}</span></div>
            <div className="c-summary-row"><span className="c-summary-label">Delivery</span><span className="c-summary-val free-val">{delivery===0?'FREE':'₹49'}</span></div>
            {delivery>0&&<div className="c-free-ship-note">Add ₹{(499-subtotal).toLocaleString('en-IN')} more for free delivery</div>}
            <div className="c-summary-row total-row"><span className="c-summary-label total-label">Total</span><span className="c-summary-val total-val">₹{total.toLocaleString('en-IN')}</span></div>
          </div>

          <button className="c-checkout-btn" onClick={()=>onCheckout(cart)}>Proceed to Checkout →</button>
          <div className="c-checkout-note">🔒 Secure checkout · Powered by ScanPress</div>
        </>}
        <div style={{height:28}}/>
      </div>
    </div>
  </div>;
}

export default function Shop(){
  const navigate=useNavigate();
  const[products,setProducts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[loadError,setLoadError]=useState(null);
  const[search,setSearch]=useState('');
  const[filter,setFilter]=useState('All');
  const[selected,setSelected]=useState(null);
  const[cartOpen,setCartOpen]=useState(false);
  const[cart,setCart]=useState([]);
  const[focused,setFocused]=useState(false);
  const searchRef=useRef(null);

  const loadProducts=useCallback(async()=>{
    setLoadError(null);

    const{data,error}=await supabase
      .from('public_products')
      .select('*')
      .order('created_at',{ascending:false});

    if(error){
      setLoadError(error.message);
      return;
    }

    setProducts(data??[]);
    setLoading(false);
  },[]);

  /* Initial load + realtime database updates */
  useEffect(()=>{
    loadProducts();

    const channel=supabase
      .channel('shop-products-live')
      .on(
        'postgres_changes',
        {event:'*',schema:'public',table:'products'},
        ()=>loadProducts()
      )
      .subscribe();

    return()=>{supabase.removeChannel(channel)};
  },[loadProducts]);

  const addToCart=useCallback((product,qty=1)=>{
    setCart(prev=>{
      const ex=prev.find(i=>i.id===product.id);
      if(ex)return prev.map(i=>i.id===product.id?{...i,qty:i.qty+qty}:i);
      return[...prev,{...product,qty}];
    });
  },[]);

  const changeQty=useCallback((id,qty)=>{
    if(qty<=0)setCart(prev=>prev.filter(i=>i.id!==id));
    else setCart(prev=>prev.map(i=>i.id===id?{...i,qty}:i));
  },[]);

  const removeFromCart=useCallback(id=>setCart(prev=>prev.filter(i=>i.id!==id)),[]);
  const clearCart=useCallback(()=>setCart([]),[]);

  const goToCheckout=useCallback(items=>{
    const checkoutItems=items.map(({qty,...item})=>({...item,quantity:qty}));
    setCartOpen(false);
    setSelected(null);
    navigate('/checkout',{state:{cart:checkoutItems}});
  },[navigate]);

  const buyNow=useCallback((product,qty=1)=>goToCheckout([{...product,qty}]),[goToCheckout]);
  const cartCount=cart.reduce((s,i)=>s+i.qty,0);

  const filtered=useMemo(()=>{
    let list=products;
    const selectedCategory=CATEGORY_VALUES[filter];

    if(selectedCategory)list=list.filter(p=>normalizeCategory(p.category)===selectedCategory);

    if(search.trim()){
      const q=search.toLowerCase();
      list=list.filter(p=>
        String(p.name||'').toLowerCase().includes(q)||
        String(p.short_desc||'').toLowerCase().includes(q)||
        String(p.category||'').toLowerCase().includes(q)
      );
    }

    return list;
  },[search,filter,products]);

  const related=useMemo(()=>{
    if(!selected)return[];
    const selectedCategory=normalizeCategory(selected.category);
    return products
      .filter(p=>normalizeCategory(p.category)===selectedCategory&&p.id!==selected.id)
      .slice(0,4);
  },[selected,products]);

  return <div className="sh-screen">

    <div className="sh-topbar">
      <div className="sh-brand">
        <div className="sh-shop-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9h18"/><path d="M5 9v10h14V9"/><path d="M3 9l2-5h14l2 5"/>
            <path d="M7 19v-5h10v5"/><path d="M3 9c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3"/>
          </svg>
        </div>
        <div className="sh-brand-name"><span className="sh-logo-accent">Print</span><span className="sh-logo-normal">Shop</span></div>
      </div>

      <button className="sh-cart-icon-btn" onClick={()=>setCartOpen(true)} aria-label="Open cart">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d84e00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.74L23 6H6"/>
        </svg>
        {cartCount>0&&<span className="sh-cart-badge">{cartCount>99?'99+':cartCount}</span>}
      </button>
    </div>

    <div className="sh-search-outer">
      <div className={`sh-search-box ${focused?'is-focused':''}`}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={focused?'#d84e00':'#b0a49c'} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search printers, ink, paper, accessories…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
          onFocus={()=>setFocused(true)}
          onBlur={()=>setFocused(false)}
          className="sh-search-input"
        />
        {search&&<button className="sh-clear-search" onClick={()=>{setSearch('');searchRef.current?.focus()}}>✕</button>}
      </div>
    </div>

    <div className="sh-filter-wrap">
      {CATEGORIES.map(cat=>{
        const on=filter===cat;
        return <button key={cat} onClick={()=>setFilter(cat)} className={`sh-pill ${on?'is-active':''}`}>
          <span className="sh-pill-icon">{CATEGORY_ICONS[cat]}</span>{cat}
        </button>;
      })}
    </div>

    <div className="sh-meta">
      <span className="sh-meta-text">
        {loading?'Loading…':`${filtered.length} product${filtered.length!==1?'s':''}`}
        {filter!=='All'?` · ${filter}`:''}{search?` · "${search}"`:''}
      </span>
      {(filter!=='All'||search)&&<button className="sh-reset-btn" onClick={()=>{setFilter('All');setSearch('')}}>Reset</button>}
    </div>

    {loading?<div className="sh-grid">
      {Array.from({length:6}).map((_,i)=><div key={i} className="p-card p-card--skeleton"/> )}
    </div>:loadError?<div className="sh-empty-state">
      <div style={{fontSize:56,marginBottom:14}}>⚠️</div>
      <div className="sh-empty-title">Couldn't load products</div>
      <div className="sh-empty-sub">{loadError}</div>
      <button className="sh-empty-reset" onClick={loadProducts}>Retry</button>
    </div>:filtered.length===0?<div className="sh-empty-state">
      <div style={{fontSize:56,marginBottom:14}}>🔍</div>
      <div className="sh-empty-title">No products found</div>
      <div className="sh-empty-sub">Try a different keyword or clear filters</div>
      <button className="sh-empty-reset" onClick={()=>{setSearch('');setFilter('All')}}>Browse All Products</button>
    </div>:<div className="sh-grid">
      {filtered.map(p=><ProductCard key={p.id} product={p} onView={setSelected} onAddToCart={addToCart} onBuyNow={buyNow}/>)}
    </div>}

    <div className="sh-footer">© 2026 ScanPress. All rights reserved.</div>
    <BottomNav active="shop"/>

    {selected&&<ProductModal
      product={selected}
      onClose={()=>setSelected(null)}
      onAddToCart={addToCart}
      onBuyNow={buyNow}
      related={related}
      onViewRelated={rp=>{setSelected(null);setTimeout(()=>setSelected(rp),120)}}
    />}

    {cartOpen&&<CartDrawer
      cart={cart}
      onClose={()=>setCartOpen(false)}
      onRemove={removeFromCart}
      onChangeQty={changeQty}
      onClear={clearCart}
      onCheckout={goToCheckout}
    />}
  </div>;
}