/**
 * ASAR JS decrypt native addon (AES+RSA hybrid).
 * Format: "CXHYB"(5) + RSA-encrypted 32-byte AES key(256) + IV(16) + AES-256-CBC ciphertext.
 * Runtime: Node uses RSA private key to get AES key, this module does AES decrypt; key in key.h only.
 */
#include <node_api.h>
#include <cstring>
#include <string>
#include "aes.h"
#include "key.h"

#define MAGIC_HYBRID "CXHYB"
#define MAGIC_LEN 5
#define RSA_ENCRYPTED_KEY_LEN 256
#define IV_LEN 16

static napi_value GetRsaPrivateKey(napi_env env, napi_callback_info info) {
  napi_value result;
  napi_status status = napi_create_string_utf8(
    env, RSA_PRIVATE_KEY_PEM, NAPI_AUTO_LENGTH, &result);
  if (status != napi_ok) return nullptr;
  return result;
}

/* decryptAes(keyBuffer, ivBuffer, ciphertextBuffer) -> UTF-8 string */
static napi_value DecryptAes(napi_env env, napi_callback_info info) {
  napi_status status;
  size_t argc = 3;
  napi_value args[3];
  status = napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (status != napi_ok || argc < 3) return nullptr;

  auto getBuf = [env](napi_value v, size_t expectLen) -> std::pair<uint8_t*, size_t> {
    bool is_buf;
    if (napi_is_buffer(env, v, &is_buf) != napi_ok || !is_buf)
      return {nullptr, 0};
    size_t len;
    char* data;
    if (napi_get_buffer_info(env, v, (void**)&data, &len) != napi_ok)
      return {nullptr, 0};
    if (expectLen != 0 && len != expectLen)
      return {nullptr, 0};
    return {(uint8_t*)data, len};
  };

  auto keyInfo = getBuf(args[0], 32);
  auto ivInfo = getBuf(args[1], 16);
  if (!keyInfo.first || !ivInfo.first) {
    napi_throw_type_error(env, nullptr, "decryptAes: key must be 32 bytes, iv must be 16 bytes Buffer");
    return nullptr;
  }

  bool is_buf;
  size_t cipher_len;
  char* cipher_data;
  if (napi_is_buffer(env, args[2], &is_buf) != napi_ok || !is_buf ||
      napi_get_buffer_info(env, args[2], (void**)&cipher_data, &cipher_len) != napi_ok ||
      cipher_len < 16 || cipher_len % 16 != 0) {
    napi_throw_type_error(env, nullptr, "decryptAes: ciphertext must be Buffer length >= 16 and multiple of 16");
    return nullptr;
  }

  std::string out;
  out.resize(cipher_len);
  memcpy(&out[0], cipher_data, cipher_len);

  struct AES_ctx ctx;
  AES_init_ctx_iv(&ctx, keyInfo.first, ivInfo.first);
  AES_CBC_decrypt_buffer(&ctx, (uint8_t*)&out[0], cipher_len);

  uint8_t pad = (uint8_t)out[cipher_len - 1];
  if (pad == 0 || pad > 16) {
    napi_throw_type_error(env, nullptr, "Invalid PKCS7 padding");
    return nullptr;
  }
  out.resize(cipher_len - pad);

  napi_value result;
  status = napi_create_string_utf8(env, out.c_str(), out.size(), &result);
  if (status != napi_ok) return nullptr;
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fnPriv, fnAes;
  napi_create_function(env, "getRsaPrivateKey", NAPI_AUTO_LENGTH, GetRsaPrivateKey, nullptr, &fnPriv);
  napi_create_function(env, "decryptAes", NAPI_AUTO_LENGTH, DecryptAes, nullptr, &fnAes);
  napi_set_named_property(env, exports, "getRsaPrivateKey", fnPriv);
  napi_set_named_property(env, exports, "decryptAes", fnAes);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
