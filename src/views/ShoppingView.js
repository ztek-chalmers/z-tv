const { html } = require('htm/react');
const { useState, useEffect, Fragment } = require('react');
const Typography = require('@material-ui/core/Typography').default;
const Table = require('@material-ui/core/Table').default;
const TableBody = require('@material-ui/core/TableBody').default;
const TableCell = require('@material-ui/core/TableCell').default;
const TableRow = require('@material-ui/core/TableRow').default;
const CircularProgress = require('@material-ui/core/CircularProgress').default;
const {Cart} = require('../Cart');
const products = require('../products');
const {hideDelay} = require('../config');
const {pay, cardBalance} = require('../bank');
const {useCardReader} = require('../CardReader');
const {useKeyboard} = require('../keyboard');
const style = require("./style");

const EMPTY = {};
function ShoppingView({goTo, setHidden}) {
  const [cart, setCart] = useState(new Cart());
  const [nextCart, setNextCart] = useState(null);
  const [state, setState] = useState(EMPTY);

  function addToCart(tp) {
    let newCart = nextCart || cart;
    newCart.add(tp);

    setState(EMPTY);
    setHidden(false);
    setCart(new Cart(newCart));
    setNextCart(null);
  }

  function set(key, value) {
    switch(key){
      case "loading": {
        setHidden(false);
        setState({loading: true});
        break;
      }
      case "canceled": {
        setState({canceled: true});
        setNextCart(new Cart());
        break;
      }
      case "balanceCheck": {
        setState({balanceCheck: value});
        setNextCart(new Cart());
        break;
      }
      case "paymentFailed": {
        setState({paymentFailed: true});
        setNextCart(new Cart());
        break;
      }
      case "paid": {
        setState({paid: value});
        setNextCart(new Cart());
        break;
      }
      case "register": {
        setHidden(false);
        setNextCart(new Cart());
        goTo("register", value);
        break;
      }
      case "swish": {
        setHidden(false);
        setNextCart(new Cart());
        goTo("swish");
        break;
      }
      default: {
        setState(EMPTY);
        setNextCart(new Cart());
        setHidden(true);
        break;
      }
    }
  }

  useEffect(()=>{
    let delay = 6*hideDelay;
    if(state.add) delay = 6*hideDelay;
    if(state.loading) delay = 60*hideDelay;
    const key = setTimeout(()=>setHidden(true), delay);
    return ()=> clearTimeout(key);
  });

  useKeyboard((key)=>{
    if(state.loading) return;
    switch(key) {
      case "1": return addToCart(products.Coffee);
      case "2": return addToCart(products.Kettle);
      case "3": return addToCart(products.Cookie);
      case "4": return addToCart(products.SandwichCake);
      case "+": {
        return set("swish");
      }
      // case "#": {
      //   set("default");
      //   setHidden(false);
      //   return goTo("transfer");
      // }
      case "Backspace": {
        if(state.canceled) return setHidden(true);
        if(state.balanceCheck) return setHidden(true);
        if(state.paymentFailed) return setHidden(true);
        if(state.paid) return setHidden(true);
        if(cart.isEmpty()) return;
        return set("canceled");
      }
    }
  });

  return html`
    <${Fragment}>
      ${!state.loading && html`<${CardListener} cart=${nextCart ? nextCart : cart} set=${set}/>`}
      <${ShoppingCart} cart=${cart}/>
      <div style=${style.overlay}>
        ${state.canceled && html`<${Canceled}/>`}
        ${state.balanceCheck && html`<${BalanceCheck} set=${set} balanceCheck=${state.balanceCheck}/>`}
        ${state.paymentFailed && html`<${PaymentFailed}/>`}
        ${state.loading && html`<${Loading}/>`}
        ${state.paid && html`<${Paid} paid="${state.paid}"/>`}
      </div>
    <//>
  `;
}

function CardListener({cart, set}) {
  const price = cart.price();
  useCardReader( async (card)=>{
    if(price === 0) {
      try {
        set("loading");
        const balance = await cardBalance(card);
        set("balanceCheck", {balance, card});
      } catch (err) {
        console.error(err);
        set();
      }
    } else {
      try {
        set("loading");
        const balance = await pay(card, price, cart.asMap());
        if(balance !== false) {
          set("paid", {price, balance});
        } else {
          set("register", card);
        }
      } catch (err) {
        console.error(err);
        set("paymentFailed");
      }
    }
  });
  return null;
}

function BalanceCheck({balanceCheck, set}) {
  const {balance, card} = balanceCheck;
  let message, color;
  console.log(balanceCheck);
  if(balance === null){
    set("register", card);
    return null;
  } else if(balance < 0){
    message = ["Det verkar vara dags att ladda kortet!", "Tryck på ladda-knappen på tangentbordet."];
    color = style.red;
  } else {
    message = ["Du har en positiv kortbalans! ZKK är tacksamma 🥰"];
    color = style.green;
  }
  return html`
    <div style=${style.layer}>
      <div style=${paidStyle}>
        <${Typography} variant="h2">Konto: ${balance || 0} kr<//>
      </div>
      <div style=${{...style.box, ...color}}>
        ${message.map(m => html`<${Typography} key=${m}>${m}<//>`)}
      </div>
    <//>
  `;
}

const redStyle = {
  ...style.center,
  ...style.red,
};
function Canceled() {
  return html`
    <div style=${redStyle}>
      <${Typography}>Tråkigt att du ångrat dig, men kom tillbaka för mer kaffe någon annan gång!<//>
    </div>
  `;
}
function PaymentFailed() {
  return html`
    <div style=${redStyle}>
      <${Typography}>Betalningen gick inte igenom...<//>
      <${Typography}>Men ta ditt fika så kan du betala för det någon annan gång!<//>
    </div>
  `;
}

const loadingStyle = {
  ...style.overlay,
  ...style.white
};
function Loading() {
  return html`
    <div style=${loadingStyle}>
      <div style=${style.center}>
        <${CircularProgress} />
      </div>
    </div>
  `;
}

const paidStyle = {
  ...style.center,
  ...style.white,
  height: "80px",
};
const paidBoxStyle = {
  ...style.green,
  ...style.box,
};
function Paid({paid}) {
  return html`
    <${Fragment}>
      <div style=${paidStyle}>
        <${Typography} variant="h2">Konto: ${paid.balance} kr<//>
      </div>
      <div style=${paidBoxStyle}>
        <${Typography}>Hoppas kaffet smakar!<//>
        ${paid.balance < 0 && html`
            <${Typography}>Det ser ut som att det är dags att ladda kortet, vilket du kan göra genom att trycka på ladda knappen!<//>
        `}
      </div>
    <//>
  `;
}

const shoppingListStyle = {
  padding: "0 20px"
};
const shoppingCartStyle = {
  ...style.gray,
  padding: "20px"
};
function ShoppingCart({cart}) {
  return html`
    <div style=${{...style.layer, minHeight: "150px"}}>
      <div style=${shoppingListStyle}>
        <${ShoppingList} cart=${cart}/>
      </div>
      <div style=${shoppingCartStyle}>
        <${Typography}>Lägg kortet på betalterminalen för att slutföra ditt köp!<//>
      </div>
    </div>
  `;
}

function ShoppingList({cart}) {
  return html`
    <${Table}>
      <${TableBody}>
        ${cart.map((item) => html`
          <${TableRow} key=${item.tp.name}>
            <${TableCell}><${item.tp.icon}/><//>
            <${TableCell}>${item.tp.name}<//>
            <${TableCell}>${item.isMax() 
                ? `MAX (${item.count}x)`
                : `${item.count}x`}
            <//>
            <${TableCell}>${item.price()} kr<//>
          <//>
        `)}
        <${TableRow}>
          <${TableCell}><//>
          <${TableCell}>Total<//>
          <${TableCell}><//>
          <${TableCell}>${cart.price()} kr<//>
        <//>
      <//>
    <//>
  `
}

module.exports = ShoppingView;