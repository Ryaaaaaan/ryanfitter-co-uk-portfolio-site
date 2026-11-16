import {useMemo,useState} from 'react';
import '../styles/dixy-review.css';

type Item={name:string;description:string;price:string;image:string;tag?:string;category:string};
const items:Item[]=[
 {name:'Fillet Burger Meal',description:'Crispy chicken fillet, fries and a drink.',price:'£6.49',image:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82',tag:'Popular',category:'Meals'},
 {name:'Wings Meal',description:'Six Dixy wings with fries and a can of soft drink.',price:'£5.89',image:'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=900&q=82',tag:'Popular',category:'Meals'},
 {name:'Value Box',description:'Two pieces of chicken, three wings, fries and a drink.',price:'£7.49',image:'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=82',category:'Meals'},
 {name:'Spicy Chicken Pizza',description:'Spicy chicken, pizza sauce and melted cheese.',price:'£6.89',image:'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=900&q=82',category:'Pizza'},
 {name:'Supreme Fillet Burger',description:'Chicken fillet with hash brown and cheese.',price:'£5.00',image:'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=82',category:'Burgers'},
 {name:'Garlic Supreme',description:'Garlic butter and cheese on a crisp base.',price:'£6.49',image:'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=82',category:'Sides'}
];
const categories=['All','Meals','Burgers','Pizza','Sides'];

function scrollTo(id:string){document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});}
export function DixyReviewPage(){
 const [category,setCategory]=useState('All');
 const [layout,setLayout]=useState<'grid'|'list'>('grid');
 const filtered=useMemo(()=>category==='All'?items:items.filter(item=>item.category===category),[category]);
 return <main className="dixy-page">
  <div className="dixy-preview"><span>DESIGN PREVIEW</span><span>Menu details, prices and brand assets need owner approval</span></div>
  <header className="dixy-header">
   <a className="dixy-brand" href="#top" aria-label="Dixy Fried Chicken Colne home">
    <span className="dixy-brand-mark">D</span><span>DIXY <small>COLNE</small></span>
   </a>
   <nav aria-label="Main navigation"><a href="#menu">Menu</a><a href="#about">Our story</a><a href="#visit">Find us</a></nav>
   <button className="dixy-order-button" onClick={()=>scrollTo('menu')}>Browse the menu <span>↗</span></button>
  </header>
  <section className="dixy-hero" id="top">
   <div className="dixy-hero-copy">
    <p className="dixy-kicker"><span/> MADE FRESH IN COLNE</p>
    <h1>Good food.<br/><em>Good mood.</em></h1>
    <p className="dixy-hero-text">From crispy chicken and loaded burgers to a pizza for the table. Find your favourites, made fresh on Market Street.</p>
    <div className="dixy-hero-actions"><button onClick={()=>scrollTo('menu')}>Explore the menu <b>↓</b></button><a href="#visit">33 Market St, Colne</a></div>
    <div className="dixy-hero-note"><span>✳</span> A local favourite, ready when you are</div>
   </div>
   <div className="dixy-hero-art">
    <div className="dixy-hero-photo"/>
    <div className="dixy-roundel"><span>CRISPY</span><b>✳</b><span>MADE FRESH</span></div>
    <div className="dixy-hero-caption"><span>01 / COLNE</span><span>FRIED CHICKEN · BURGERS · PIZZA</span></div>
   </div>
  </section>
  <section className="dixy-trustbar" aria-label="Restaurant details">
   <div><strong>01</strong><span>Order your favourites</span></div><i/>
   <div><strong>02</strong><span>Made fresh to order</span></div><i/>
   <div><strong>03</strong><span>Collect in Colne</span></div><i/>
   <div className="dixy-address">33 Market Street <span>·</span> Colne, BB8 0LJ</div>
  </section>
  <section className="dixy-menu-section" id="menu">
   <div className="dixy-section-heading">
    <div><p className="dixy-kicker"><span/> SOMETHING FOR EVERY CRAVING</p><h2>The good stuff.</h2><p>Take a look through a few customer favourites. The full menu is coming soon.</p></div>
    <div className="dixy-menu-controls" aria-label="Menu display options">
     <div className="dixy-layout-toggle"><button aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}>▦ Grid</button><button aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>☰ List</button></div>
    </div>
   </div>
   <div className="dixy-menu-filter" role="tablist" aria-label="Menu categories">
    {categories.map(name=><button key={name} role="tab" aria-selected={category===name} onClick={()=>setCategory(name)}>{name}</button>)}
   </div>
   <div className={'dixy-items dixy-items-'+layout}>
    {filtered.map((item,index)=><article className="dixy-item" key={item.name}>
     <div className="dixy-item-image"><img src={item.image} alt="" loading={index>2?'lazy':'eager'}/>{item.tag&&<span className="dixy-item-tag">{item.tag}</span>}</div>
     <div className="dixy-item-copy"><div><h3>{item.name}</h3><p>{item.description}</p></div><strong>{item.price}</strong></div>
    </article>)}
   </div>
   <p className="dixy-menu-footnote">Preview only · Illustrative food photography · Prices and menu must be confirmed by the restaurant</p>
  </section>
  <section className="dixy-about" id="about">
   <div className="dixy-about-image"><div className="dixy-about-badge">COLNE<br/><span>EST. LOCAL</span></div></div>
   <div className="dixy-about-copy"><p className="dixy-kicker"><span/> FROM OUR KITCHEN TO YOURS</p><h2>Made for<br/>your kind of night.</h2><p>Whether it’s a quick bite, a family feast or the usual Friday order, Dixy Fried Chicken Colne brings together the classics people come back for.</p><p>This section can tell the restaurant’s real story once the owner shares the details they want customers to know.</p><a href="#visit">Come and find us <b>↗</b></a></div>
  </section>
  <section className="dixy-visit" id="visit">
   <div><p className="dixy-kicker"><span/> YOUR LOCAL DIXY</p><h2>Meet us on<br/><em>Market Street.</em></h2></div>
   <div className="dixy-visit-details"><p>33 Market St<br/>Colne, BB8 0LJ</p><span>Opening hours and contact details to be confirmed with the restaurant.</span><a href="https://maps.google.com/?q=33+Market+St,+Colne+BB8+0LJ" target="_blank" rel="noreferrer">Get directions <b>↗</b></a></div>
  </section>
  <footer className="dixy-footer"><a className="dixy-brand" href="#top"><span className="dixy-brand-mark">D</span><span>DIXY <small>COLNE</small></span></a><span>DESIGN CONCEPT · OWNER REVIEW</span><a href="#top">Back to top ↑</a></footer>
 </main>;
}
