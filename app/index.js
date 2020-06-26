var config = require('./config.json');
const {
  Rcon
} = require('rcon-client');
const schedule = require('node-schedule');
const moment = require('moment');
const events = require('events');
const steamcmd = require('steamcmd');
const path = require('path');
require("file-logger")(true);

// http://arkdedicated.com/version
// TODO: apply rcon.end fix on every machine where this app is used

const save_hour = 5;
const save_minute = 0;
var Emitter = new events.EventEmitter();
var patch_version = '0';
var steam_opts = {
  "binDir": path.join(__dirname, 'steamcmd_bin')
}

console.log('Servers to watch:', config.server.length);

config.server.forEach(element => {
  element.rcon = new Rcon({
    host: element.ip,
    port: element.rconport,
    password: element.rconpassword,
    timeout: 15000
  });

  element.rcon.on("connect", () => console.log("connected", element.name));
  element.rcon.on("authenticated", () => console.log("authenticated", element.name));
  element.rcon.on("end", () => console.log("end", element.name));
});

var broadcast = async function broadcast(message) {
  config.server.forEach(async element => {
    if (!element.rcon.socket) {
      await element.rcon.connect();
    }
    await element.rcon.send("Broadcast " + message);
    console.log(element.name, message);
  });
};
Emitter.on('broadcast', broadcast);
// Saveworld
var saveworld = async function saveworld() {
  config.server.forEach(async element => {
    if (!element.rcon.socket) {
      await element.rcon.connect();
    }
    await element.rcon.send("Broadcast [DE] Server wird gespeichert!\n[EN] Server save!");
    await element.rcon.send("SaveWorld");
    console.log('SaveWorld on:', element.name);
  });
};
Emitter.on('saveworld', saveworld);
//Patch Check
var patch_update_check = async function patch_update_check() {
  const info = await steamcmd.getAppInfo(376030, steam_opts);
  let htmlString = info.depots.branches.public.buildid;
  // console.log('Patch:', htmlString);
  if (patch_version == 0) {
    console.log('version changed from 0 to string', htmlString);
  } else if (patch_version != htmlString) {
    // UPDATE!!!
    console.log('Patch found!!!');
    Emitter.emit('patch_update');
  }
  patch_version = htmlString;
};
Emitter.on('patch_update_check', patch_update_check);
//Patch found!
var patch_update = async function patch_update() {
  Emitter.emit('broadcast', "[DE] ARK Patch gefunden, es kann sein das die Server bald neustarten, es wird zur Sicherheit gespeichert!\n[EN] ARK Patch found, it is possible that the servers will restart soon! Server save!");
  setTimeout(() => {
    Emitter.emit('saveworld');
  }, 3000);
};
Emitter.on('patch_update', patch_update);

async function main() {
  await steamcmd.download(steam_opts);
  await steamcmd.touch(steam_opts);
  await steamcmd.prep(steam_opts);

  // Emitter.emit('broadcast', "Test");
  var j = schedule.scheduleJob('0 * * * * *', async function () {
    let hour = moment().format('H');
    let minute = moment().format('m');
    if ( moment() <= moment().hour(save_hour).minute(save_minute) && moment() >= moment().hour(save_hour).minute(save_minute).subtract(10, 'minutes') ) {
      let calc_minute_left;
      if (save_minute == 0) calc_minute_left = 60
      else calc_minute_left = save_minute;
      let minutes_to_restart = calc_minute_left - minute;
      let save_minute_calc;
      if (save_minute == 0) save_minute_calc = 60;
      else save_minute_calc = save_minute;
      if (minute >= save_minute_calc - 10 && minute <= save_minute_calc - 1) {
        Emitter.emit('broadcast', "[DE] Server wird in " + minutes_to_restart + " Minuten gespeichert!\n[EN] Server will be saved in " + minutes_to_restart + ' minutes!');
      }
    }
    if (hour == save_hour && minute == save_minute) {
      Emitter.emit('saveworld');
    }
  });

  var jj = schedule.scheduleJob('*/30 * * * * *', async function () {
    Emitter.emit('patch_update_check');
  });
  // console.log(await rcon.send("DoExit"));
}
main().catch(console.error);
