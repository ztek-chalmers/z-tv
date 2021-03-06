const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const { useEffect } = require('react');
const crypto = require('crypto');

class CardReader {
  constructor() {
    this.reader = null;
    this.pendingHandle = null;
    this.hasRead = false;
  }

  scheduleListen(fn) {
    this.pendingHandle = setTimeout(()=>this.listen(fn), 10000);
  }

  listen(fn) {
    clearTimeout(this.pendingHandle);
    if(this.reader) return;
    SerialPort.list((err, ports) => {
      if(this.reader) return;
      if(err) {
        console.error("Could not list devices, trying again in 10 seconds", err);
        return this.scheduleListen(fn);
      }

      console.log('Found ports', ports);
      const cardReaderPort = ports.find(p => p.manufacturer === "Olimex Ltd");
      if(!cardReaderPort) {
        console.log("Could not find device, trying to connect again in 10 seconds");
        return this.scheduleListen(fn);
      }

      const cardReader = new SerialPort(cardReaderPort.comName, {baudRate: 115200, autoOpen: false });
      cardReader.open((err) => {
        if (err) {
          console.log("Could not connect to device, trying to connect again in 10 seconds");
          return this.scheduleListen(fn);
        }
        this.reader = cardReader;
        console.log("Connected to card reader!");

        cardReader.on('close', () => {
          if(!this.reader) return;
          console.log("The card reader port was closed, trying to connect again in 10 seconds");
          this.reader = null;
          this.scheduleListen(fn);
        });

        const parser = new Readline();
        cardReader.pipe(parser);
        parser.on('data', line => {
          line = line.trim();
          if(line === "") return;
          if(line === ">") return;
          if(line.indexOf("ERR") === 0) return;
          const hash = crypto.createHash('sha256')
            .update(line)
            .digest('hex')
            .substr(0, 16);
          console.log(`Read card \nNumber: ${line} \nHash: ${hash}`);
          this.hasRead = true;
          fn(hash);
        });
      });
    });
  }

  unListen() {
    if(this.reader) {
      const reader = this.reader;
      this.reader = null;
      console.log("Disconnecting from card reader...");
      reader.close();
      console.log("Disconnected!");
    }
  }
}

let reader;
let readerFn = ()=>{};
function useCardReader(fn) {
  if(!reader) {
    reader = new CardReader();
    reader.listen((card)=>readerFn(card));
  }
  useEffect(() => {
    readerFn = fn;
    return ()=> {readerFn = ()=>{}};
  });
  useEffect(() => {
    if(!reader.hasRead) {
      return keyboardCardReader(fn);
    }
  });
}

function keyboardCardReader(fn) {
  function cb (event) {
    if(event.key === "!") {
      event.preventDefault();
      fn("test");
    }
    if(event.key === "@") {
      event.preventDefault();
      fn("test-2");
    }
  }
  document.body.addEventListener("keydown", cb);
  return ()=>document.body.removeEventListener("keydown", cb);
}

module.exports = {useCardReader, CardReader};
