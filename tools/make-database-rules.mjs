#!/usr/bin/env node
/* 產生 database.rules.json（Realtime Database 規則：同學在線上）
 *
 *   node tools/make-database-rules.mjs
 *
 * Realtime Database 的規則不能寫函式，同樣的條件要重複好幾次，所以用這支組起來；要改規則改這裡，不要直接改 json。
 * 產生之後要把 database.rules.json 的內容貼到 Firebase 主控台 → Realtime Database → 規則 → 發布，才會生效。
 * 測試：node tools/test-database-rules.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EMAIL = 'auth.token.email.toLowerCase()';
const TEACHER = `${EMAIL}.matches(/^[^@]+@skps[.]tp[.]edu[.]tw$/)`;
const STUDENT = `${EMAIL}.matches(/^[^@]+@st[.]skps[.]tp[.]edu[.]tw$/)`;
const SCHOOL = `auth != null && auth.token.email_verified === true && (${TEACHER} || ${STUDENT})`;
const KEY = `${EMAIL}.replace('.', ',')`;
const ADMIN = `${SCHOOL} && root.child('online/admins/' + ${KEY}).val() === true`;
const CFG = (k) => `root.child('online/config/${k}').val()`;
const HOUR = '((now + 28800000) % 86400000)';
// 可以加入：學校帳號、總開關開、在開放時段、（全校開放 或 測試名單 或 管理員）、沒有被停用
const CAN = `${SCHOOL} && ${CFG('on')} === true && ${HOUR} >= ${CFG('from')} * 3600000 && ${HOUR} < ${CFG('to')} * 3600000`
  + ` && (${CFG('stage')} === 'all' || root.child('online/testers/' + ${KEY}).val() === true || root.child('online/admins/' + ${KEY}).val() === true)`
  + ` && !root.child('online/blocked/' + auth.uid).exists()`;
// 自己的那一格：刪除隨時可以（斷線、離開），寫入要符合 CAN；管理員可以刪別人的
const OWN = `(auth != null && auth.uid === $uid && (!newData.exists() || (${CAN}))) || (!newData.exists() && ${ADMIN})`;
const NAME = `newData.isString() && newData.val().length >= 1 && newData.val().length <= 40 && (auth.token.name === newData.val() || auth.token.name === newData.val() + newData.val() || auth.token.name === newData.val() + ' ' + newData.val())`;

const rules = {
  rules: {
    '.read': false,
    '.write': false,
    online: {
      config: {
        '.read': SCHOOL,
        '.write': ADMIN,
        '.validate': "newData.hasChildren(['on', 'stage', 'from', 'to'])",
        on: { '.validate': 'newData.isBoolean()' },
        stage: { '.validate': "newData.val() === 'test' || newData.val() === 'all'" },
        from: { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 24' },
        to: { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 24' },
        $other: { '.validate': false },
      },
      admins: { $key: { '.read': `${SCHOOL} && ${KEY} === $key` } },
      testers: {
        '.read': ADMIN,
        $key: { '.read': `${SCHOOL} && ${KEY} === $key`, '.write': ADMIN, '.validate': 'newData.val() === true' },
      },
      blocked: {
        '.read': ADMIN,
        $uid: { '.read': 'auth != null && auth.uid === $uid', '.write': ADMIN, '.validate': 'newData.isString() && newData.val().length <= 40' },
      },
      players: {
        '.read': CAN,
        $uid: {
          '.write': OWN,
          '.validate': "newData.hasChildren(['n', 'r', 'g', 'o', 'f', 't'])",
          n: { '.validate': NAME },
          r: { '.validate': `(newData.val() === 't' && ${TEACHER}) || (newData.val() === 's' && ${STUDENT})` },
          g: { '.validate': "newData.val() === 'boy' || newData.val() === 'girl'" },
          o: { '.validate': 'newData.isString() && newData.val().length <= 24 && newData.val().matches(/^[-a-z]+$/)' },
          f: { '.validate': 'newData.isString() && newData.val().matches(/^[B1-5][1F]$/)' },
          t: { '.validate': 'newData.val() === now' },
          $other: { '.validate': false },
        },
      },
      pos: {
        $floor: {
          '.read': CAN,
          $uid: {
            '.write': OWN,
            // 要先有名牌（players），而且樓層跟名牌一樣：不能當隱形人、不能同時出現在好幾層
            '.validate': "$floor.matches(/^[B1-5][1F]$/) && newData.isString() && newData.val().length <= 30 && newData.val().matches(/^[-0-9]+,[-0-9]+,[0-9]+,[01],[-0-9]+$/) && newData.parent().parent().parent().child('players').child($uid).child('f').val() === $floor",
          },
        },
      },
    },
  },
};
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'database.rules.json');
fs.writeFileSync(out, JSON.stringify(rules, null, 2) + '\n');
console.log('已產生', out);
