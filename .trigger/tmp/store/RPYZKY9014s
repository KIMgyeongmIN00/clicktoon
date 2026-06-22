import {
  __name,
  init_esm
} from "./chunk-SNESNKQK.mjs";

// lib/crypto/hmac.ts
init_esm();
import { createHmac, timingSafeEqual } from "node:crypto";
function signPayload(secret, timestamp, rawBody) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}
__name(signPayload, "signPayload");

export {
  signPayload
};
//# sourceMappingURL=chunk-XW2K676Y.mjs.map
