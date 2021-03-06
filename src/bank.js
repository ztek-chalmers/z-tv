const firebase = require("firebase");
const {Timestamp} = firebase.firestore;
const accountConfig = require("../account.json");
const appConfig = require("../app.json");

let db;
async function connectToFirebase({quiet}={}) {
  if(!quiet) console.log("connecting to database...");
  const app = firebase.initializeApp(appConfig);
  const {email, password} = accountConfig;
  await firebase.auth().signInWithEmailAndPassword(email, password);
  db = app.firestore();
  if(!quiet) console.log("connected to database")
}

class AlreadyJoinedError extends Error {}
class NotJoinedError extends Error {}

function getDB() {
  return db;
}

async function join(cardNumber1, cardNumber2) {
  if(!db) await connectToFirebase();
  const card1 = db.collection(`cards`).doc(`${cardNumber1}`);
  const card2 = db.collection(`cards`).doc(`${cardNumber2}`);
  let account1 = await getAccountRef(card1);
  let account2 = await getAccountRef(card2);

  if(account1 && account2) {
    if (account1.isEqual(account2)) {
      throw new AlreadyJoinedError("");
    }
    const account1D = await getAccountData(account1);
    const account2D = await getAccountData(account1);
    if (!account1D || !account2D) {
      throw new Error("Could not get account data");
    }
    await payFromAccount(account1, -account2D.balance, {transferFrom: 1});
    await payFromAccount(account2, account2D.balance, {transferTo: 1});
    await card2.set({account: account1});
  } else if (account1) {
    await card2.set({account: account1});
  } else if(account2) {
    await card1.set({account: account2});
  } else {
    const account = db.collection(`accounts`).doc();
    await setAccountBalance(account, 0);
    await card1.set({account});
    await card2.set({account});
  }
}

async function split(cardNumber1, cardNumber2) {
  if(!cardNumber1) throw new Error("Card 1 invalid: "+ cardNumber1);
  if(!cardNumber2) throw new Error("Card 2 invalid: "+ cardNumber2);

  if(!db) await connectToFirebase();
  const card1 = db.collection(`cards`).doc(`${cardNumber1}`);
  const card2 = db.collection(`cards`).doc(`${cardNumber2}`);
  let account1 = await getAccountRef(card1);
  let account2 = await getAccountRef(card2);

  if(!account1 || !account2)
    throw new NotJoinedError("");
  if(!account1.isEqual(account2))
    throw new NotJoinedError("");

  const account = db.collection(`accounts`).doc();
  await setAccountBalance(account, 0);
  await card2.set({account});
}

async function getAccountRef(card) {
  const cardSnapshot = await card.get();
  if(!cardSnapshot.exists) return;
  return cardSnapshot.data().account;
}

async function getAccountData(account) {
  if(!account) return null;
  const accountSnapshot = await account.get();
  if(!accountSnapshot.exists) return;
  return accountSnapshot.data().data || accountSnapshot.data();
}

async function setAccountBalance(account, balance) {
  const lastUsed = Timestamp.now();
  if(Number.isNaN(balance)) throw new Error("Invalid balance: "+ balance);
  await account.set({lastUsed, balance});
  return balance;
}

async function payFromAccount(account, amount, items) {
  let data = await getAccountData(account);
  let balance = (data && data.balance) ? data.balance : 0;
  const newBalance = await setAccountBalance(account, balance - amount);
  // const itemDocument = db.collection(`log-items`).doc();
  // itemDocument.set(items).catch(console.error);
  db.collection(`logs`).doc().set({
    timeStamp: Timestamp.now(),
    items: items,
    account: account,
    amount: -amount
  }).catch(console.error);
  return newBalance;
}

async function pay(cardNumber, amount, items={}) {
  if(!cardNumber) throw new Error("Invalid card number: "+ cardNumber);
  if(!db) await connectToFirebase();
  const card = db.collection(`cards`).doc(`${cardNumber}`);

  const account = await getAccountRef(card);
  if(!account) {
    return false;
  }

  return await payFromAccount(account, amount, items);
}

async function cardBalance(cardNumber) {
  if(!cardNumber) throw new Error("Invalid card numbe: "+ cardNumber);
  if(!db) await connectToFirebase();
  const card = db.collection(`cards`).doc(`${cardNumber}`);

  const account = await getAccountRef(card);
  if(!account) return null;

  const data = await getAccountData(account);
  const balance = (data && data.balance) ? data.balance : 0;
  return balance;
}

module.exports = {pay, cardBalance, join, split, AlreadyJoinedError, NotJoinedError, connectToFirebase, getDB};
