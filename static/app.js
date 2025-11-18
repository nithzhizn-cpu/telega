
// Simple E2EE chat using WebCrypto: X25519 (ECDH) + AES-GCM
const API_BASE = window.location.origin + "/api";

let me = null;          // {id, username, public_key}
let myKeyPair = null;   // CryptoKeyPair for ECDH
let myPrivKey = null;
let myPubJwk = null;

let currentPeer = null; // selected user object
let sharedKeys = {};    // peerId -> CryptoKey (AES-GCM)

const enc = new TextEncoder();
const dec = new TextDecoder();

function logStatus(msg) {
  document.getElementById("backend-status").innerText = msg;
}

async function checkBackend() {
  try {
    const r = await fetch(window.location.origin + "/health");
    if (!r.ok) throw new Error();
    const j = await r.json();
    logStatus("Backend: " + (j.status || "unknown"));
  } catch (e) {
    logStatus("Backend: недоступний");
  }
}
checkBackend();

async function loadOrCreateKeys() {
  if (myKeyPair) return;
  const stored = localStorage.getItem("ss_v2_keypair");
  if (stored) {
    const data = JSON.parse(stored);
    myPubJwk = data.publicJwk;
    myKeyPair = {
      publicKey: await crypto.subtle.importKey(
        "jwk",
        data.publicJwk,
        { name: "ECDH", namedCurve: "X25519" },
        true,
        []
      ),
      privateKey: await crypto.subtle.importKey(
        "jwk",
        data.privateJwk,
        { name: "ECDH", namedCurve: "X25519" },
        false,
        ["deriveKey", "deriveBits"]
      )
    };
    myPrivKey = myKeyPair.privateKey;
  } else {
    myKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "X25519" },
      true,
      ["deriveKey", "deriveBits"]
    );
    myPrivKey = myKeyPair.privateKey;
    myPubJwk = await crypto.subtle.exportKey("jwk", myKeyPair.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", myKeyPair.privateKey);
    localStorage.setItem("ss_v2_keypair", JSON.stringify({
      publicJwk: myPubJwk,
      privateJwk: privJwk
    }));
  }
}

async function registerUser() {
  const username = document.getElementById("username").value.trim();
  if (!username) {
    alert("Введіть позивний");
    return;
  }
  await loadOrCreateKeys();
  try {
    const res = await fetch(API_BASE + "/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        public_key: JSON.stringify(myPubJwk)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(data);
      alert("Помилка реєстрації");
      return;
    }
    me = data;
    document.getElementById("me-info").innerText =
      "ID: " + me.id + " | username: " + me.username;
  } catch (e) {
    console.error(e);
    alert("Помилка мережі");
  }
}

async function searchUsers() {
  const q = document.getElementById("search").value.trim();
  if (!q) {
    document.getElementById("results").innerHTML = "";
    return;
  }
  try {
    const res = await fetch(API_BASE + "/users/search?q=" + encodeURIComponent(q));
    if (!res.ok) throw new Error();
    const users = await res.json();
    const div = document.getElementById("results");
    div.innerHTML = "";
    users
      .filter(u => !me || u.id !== me.id)
      .forEach(u => {
        const el = document.createElement("div");
        el.className = "small";
        el.style.cursor = "pointer";
        el.textContent = u.username + " (id " + u.id + ")";
        el.onclick = () => selectPeer(u);
        div.appendChild(el);
      });
  } catch (e) {
    console.error(e);
  }
}

async function deriveSharedKey(peer) {
  if (!myKeyPair) await loadOrCreateKeys();
  const cacheKey = "peer_" + peer.id;
  if (sharedKeys[cacheKey]) return sharedKeys[cacheKey];

  const peerPubJwk = JSON.parse(peer.public_key);
  const peerPubKey = await crypto.subtle.importKey(
    "jwk",
    peerPubJwk,
    { name: "ECDH", namedCurve: "X25519" },
    false,
    []
  );

  // Derive AES-256-GCM key from ECDH
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: peerPubKey
    },
    myPrivKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
  sharedKeys[cacheKey] = aesKey;
  return aesKey;
}

async function selectPeer(user) {
  currentPeer = user;
  document.getElementById("peer-label").innerText =
    "Чат з: " + user.username + " (id " + user.id + ")";
  // Load history
  await loadHistory();
}

function renderMessage(msg, plaintextObj) {
  const chat = document.getElementById("chat");
  const div = document.createElement("div");
  div.className = "msg" + (me && msg.from_id === me.id ? " me" : "");
  if (!plaintextObj || plaintextObj.kind === "text") {
    div.textContent = plaintextObj ? plaintextObj.body : "[невідоме повідомлення]";
  } else if (plaintextObj.kind === "file") {
    const a = document.createElement("a");
    a.href = plaintextObj.data;
    a.download = plaintextObj.name || "file";
    a.textContent = "📎 " + (plaintextObj.name || "Зашифрований файл");
    div.appendChild(a);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function decryptMessage(msg) {
  if (!currentPeer || !me) return;
  const aesKey = await deriveSharedKey(currentPeer);
  try {
    const ivBytes = Uint8Array.from(atob(msg.iv), c => c.charCodeAt(0));
    const ctBytes = Uint8Array.from(atob(msg.ciphertext), c => c.charCodeAt(0));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      aesKey,
      ctBytes
    );
    const json = dec.decode(plainBuf);
    return JSON.parse(json);
  } catch (e) {
    console.warn("decrypt failed", e);
    return null;
  }
}

async function loadHistory() {
  if (!me || !currentPeer) return;
  const chat = document.getElementById("chat");
  chat.innerHTML = "";
  try {
    const url = API_BASE + "/messages/history?user_id=" + me.id + "&peer_id=" + currentPeer.id;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const msgs = await res.json();
    for (const m of msgs) {
      const pt = await decryptMessage(m);
      renderMessage(m, pt);
    }
  } catch (e) {
    console.error(e);
  }
}

async function encryptPayload(peer, payloadObj) {
  const aesKey = await deriveSharedKey(peer);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const json = JSON.stringify(payloadObj);
  const buf = enc.encode(json);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    buf
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
  return { iv: ivB64, ciphertext: ctB64 };
}

async function sendMessage() {
  if (!me) {
    alert("Спочатку підключись (введи позивний)");
    return;
  }
  if (!currentPeer) {
    alert("Обери співрозмовника");
    return;
  }
  const text = document.getElementById("msg").value.trim();
  if (!text) return;

  const payload = { kind: "text", body: text };
  try {
    const { iv, ciphertext } = await encryptPayload(currentPeer, payload);
    const res = await fetch(API_BASE + "/messages/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_id: me.id,
        to_id: currentPeer.id,
        iv,
        ciphertext
      })
    });
    if (!res.ok) throw new Error();
    const saved = await res.json();
    renderMessage(saved, payload);
    document.getElementById("msg").value = "";
  } catch (e) {
    console.error(e);
    alert("Помилка надсилання");
  }
}
