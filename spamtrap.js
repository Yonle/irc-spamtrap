
// Spamtrap - Basically spam fishing then GLine them.
// This only works for ngircd server for a moment.

// --- Begin Config ---

const config = {

  // Server Information (NO TLS)
  host: "localhost",
  port: 6667,

  // Bot Information
  user: "Spamtrap_",
  nick: "Spamtrap_",
  real: "Spam trapper bot",

  // Commands to run after connect
  // The bot requires to be an oper in order to work.
  autorun: [
    `OPER user name`,
    `MODE Spamtrap_ +iI`
  ],

  // How many trap channels?
  trapchans: 100,

  // The *-Line reason.
  killreason: "Spam bot detected. If this was a mistake, contact to support@example.com",
  lineduration: 3600*24*30 // 30 days
}

// --- End of config ---


// After you edited the config, Install better-sqlite3 with the following command:
//   $ npm install better-sqlite3

// Once finished, You could start the bot with the following:
//   $ node index.js

// Additionally, You could run the bot at background with tmux:
//   $ tmux new -d "node index.js"





















// Below is an source code.

/*

  BSD 3-Clause License

  Copyright (c) 2023, Yonle <yonle@lecturify.net>
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  1. Redistributions of source code must retain the above copyright notice, this
     list of conditions and the following disclaimer.

  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.

  3. Neither the name of the copyright holder nor the names of its
     contributors may be used to endorse or promote products derived from
     this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
  FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
  DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
  SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
  CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
  OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

                                                                               */

const SQLITE3 = require("better-sqlite3");
const { spawn } = require("child_process");
const { inspect } = require("util");
const net = require("net");
const irc = new net.Socket();
const connectIRC = _ => irc.connect(config.port, process.argv[2] || config.host);

const sess = new Map();
const requests = {};

const db = SQLITE3("database.db");

db.exec("CREATE TABLE IF NOT EXISTS bots (nick TEXT, host TEXT, date INT, UNIQUE(host));")

let junkyards = [];

while (junkyards.length < config.trapchans) {
  junkyards.push("#" + Math.random().toString(36).slice(2));
}

irc.on("connect", _ => {
  console.log("--- Connected.");
  irc.setEncoding("utf8");
  irc.write([
    `NICK ${config.nick}`,
    `USER ${config.user} * * :${config.real}`,
    ...config.autorun
  ].join("\r\n") + "\r\n");
});

irc.ban = (nick, host) => {
  const date = Math.floor(Date.now() / 1000);
  console.log("----", "G-Lining", nick, "from", host);
  irc.write(`GLINE *!*@${host} ${config.lineduration} :${config.killreason}\r\n`);
  irc.write(`KILL ${nick} :${config.killreason}\r\n`);
  db.prepare("INSERT OR IGNORE INTO bots VALUES (?, ?, ?);")
    .run(nick, host, date);
}

let nickretries = 1;
irc.on("data", data => {
  if (data.split("\n").length > 2) return data.split("\n").map(i => i + "\n").forEach(_ => irc.emit("data", _));
  let mask = data.split(" ")[0].slice(1);
  let nick = mask.split("!")[0];
  if (data.startsWith(":")) data = data.split(" ").slice(1).join(" ");
  if (data.startsWith("433 ")) return irc.write(`NICK ${config.nick + nickretries++}\r\n`);
  if (data.startsWith("001")) return irc.write(junkyards.map(i => "JOIN " + i).join("\r\n") + "\r\n");
  if (data.startsWith("PING ")) return irc.write("PONG " + data.slice(5));

  if (data.startsWith("PRIVMSG ")) {
    const msg = data.slice(0, data.length - 2).split(":").slice(1).join(":");
    const chan = data.slice(8, (data.length-msg.length)-4);
    const argv = msg.split(" ");

    if (!(chan === config.nick || junkyards.includes(chan))) return;
    irc.write(`WHOIS ${nick} ${nick}\r\n`);
  }

  if (data.startsWith("378")) {
    let ip = data.split(":is connecting from ")[1].split(" ").pop();
    let nick = data.split(" ")[2];
    ip = ip.slice(0, ip.length - 2);
    irc.ban(nick, ip);
  }
});

irc.on("close", connectIRC);
irc.on("error", console.error);

connectIRC();

setInterval(_ =>
  irc.write("PING :" + Date.now() + "\r\n")
, 1000 * 30);
