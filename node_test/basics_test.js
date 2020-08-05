/*
 * Copyright 2018 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
//
const test = require("ava");
const {
  createAccount,
  createOperator,
  createUser,
  fromPublic,
  fromSeed,
  decode,
  encode,
  NKeysErrorCode,
} = require("../lib/index");
const {
  createCluster,
  createServer,
  Prefix,
} = require("../lib/nkeys");

const { Codec } = require("../lib/codec");

function testClear(t, kp) {
  kp.clear();

  t.throws(() => {
    kp.getPublicKey();
  }, { code: NKeysErrorCode.ClearedPair });

  t.throws(() => {
    kp.getPrivateKey();
  }, { code: NKeysErrorCode.ClearedPair });

  t.throws(() => {
    kp.getSeed();
  }, { code: NKeysErrorCode.ClearedPair });

  t.throws(() => {
    const data = new TextEncoder().encode("hello");
    kp.sign(data);
  }, { code: NKeysErrorCode.ClearedPair });

  t.throws(() => {
    const data = new TextEncoder().encode("hello");
    const sig = kp.sign(data);
    kp.verify(data, sig);
  }, { code: NKeysErrorCode.ClearedPair });
}

function doTest(t, kp, kind) {
  t.truthy(kp);

  const seed = kp.getSeed();
  t.is(seed[0], "S".charCodeAt(0));
  t.is(seed[1], kind.charCodeAt(0));

  const publicKey = kp.getPublicKey();
  t.is(publicKey[0], kind.charAt(0));

  const data = new TextEncoder().encode("HelloWorld");
  const sig = kp.sign(data);
  t.is(sig.length, 64);
  t.true(kp.verify(data, sig));

  const sk = fromSeed(seed);
  t.true(sk.verify(data, sig));

  const pub = fromPublic(publicKey);
  t.is(pub.getPublicKey(), publicKey);
  t.true(pub.verify(data, sig));

  t.throws(() => {
    pub.getPrivateKey();
  }, { code: NKeysErrorCode.PublicKeyOnly });
  t.true(pub.verify(data, sig));

  t.throws(() => {
    pub.getSeed();
  }, { code: NKeysErrorCode.PublicKeyOnly });

  testClear(t, kp);
  testClear(t, pub);
}

test("basics - operator", (t) => {
  doTest(t, createOperator(), "O");
});

test("basics - account", (t) => {
  doTest(t, createAccount(), "A");
});

test("basics - user", (t) => {
  doTest(t, createUser(), "U");
});

test("basics - cluster", (t) => {
  doTest(t, createCluster(), "C");
});

test("basics - server", (t) => {
  doTest(t, createServer(), "N");
});

test("integration - verify", (t) => {
  let data = {
    "seed": "SAAFYOZ5U4UBAJMHPITLSKDWAFBJNWH53K7LPZDQKOC5TXAGBIP4DY4WCA",
    "public_key": "AAASUT7FDZDS6UCTBE7JQS2G6KUZBJC5YW7VFVK45JLUK3UDVA6NXJWD",
    "private_key":
      "PBODWPNHFAICLB32E24SQ5QBIKLNR7O2X236I4CTQXM5YBQKD7A6GAJKJ7SR4RZPKBJQSPUYJNDPFKMQURO4LP2S2VOOUV2FN2B2QPG3AHUA",
    "nonce": "uPMbFqF4nSX75B0Nlk9uug==",
    "sig":
      "y9t/0VxLZET6fYlSL7whq52TSv8tP7FBXZdqbQhfdpKCa3pveV7889zqkpiQcv8ivwtACQwumPe6EgrxFc7yDw==",
  };

  const te = new TextEncoder();
  const pk = fromPublic(data.public_key);
  let nonce = te.encode(data.nonce);
  let sig = decode(data.sig);
  t.true(pk.verify(nonce, sig));

  const seed = fromSeed(te.encode(data.seed));
  t.true(seed.verify(nonce, sig));
  const sig2 = seed.sign(nonce);
  const encsig = encode(sig2);
  t.is(encsig, data.sig);
});

test("integration - encoded seed returns stable values albertor", (t) => {
  let data = {
    "seed": "SUAGC3DCMVZHI33SMFWGEZLSORXXEYLMMJSXE5DPOJQWYYTFOJ2G64VAPY",
    "public_key": "UAHJLSMYZDJCBHQ2SARL37IEALR3TI7VVPZ2MJ7F4SZKNOG7HJJIYW5T",
    "private_key":
      "PBQWYYTFOJ2G64TBNRRGK4TUN5ZGC3DCMVZHI33SMFWGEZLSORXXEDUVZGMMRURATYNJAIV57UCAFY5ZUP22X45GE7S6JMVGXDPTUUUMRKXA",
    "nonce": "P6Gz7PfS+Cqt0qTgheqa9w==",
    "sig":
      "Dg8/bNrSx/TqBiETRjkVIa3+vx8bQc/DcoFBuFfUiHAEWDsSkzNLgseZlP+x9ndVCoka6YpDIoTzc5NjHTgPCA==",
  };

  const td = new TextDecoder();
  const v = Codec.encodeSeed(
    Prefix.User,
    new TextEncoder().encode("albertoralbertoralbertoralbertor"),
  );
  t.is(td.decode(v), data.seed);

  const kp = fromSeed(v);
  t.is(td.decode(kp.getSeed()), data.seed, "seed");
  t.is(kp.getPublicKey(), data.public_key, "public key");
  t.is(td.decode(kp.getPrivateKey()), data.private_key, "private key");
});
