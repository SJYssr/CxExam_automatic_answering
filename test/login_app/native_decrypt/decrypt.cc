/**
 * ASAR JS decrypt native addon. Key lives here only; decrypt at runtime via Module hook.
 * Format: "CXENC"(5) + IV(16) + AES-256-CBC(ciphertext, PKCS7)
 */
#include <node_api.h>
#include <cstring>
#include <string>
#include "aes.h"
#include "key.h"

#define MAGIC "CXENC"
#define MAGIC_LEN 5
#define IV_LEN 16

static napi_value Decrypt(napi_env env, napi_callback_info info) {
    napi_status status;
    size_t argc = 1;
    napi_value args[1];
    status = napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    if (status != napi_ok || argc < 1) return nullptr;

    bool is_buffer;
    status = napi_is_buffer(env, args[0], &is_buffer);
    if (status != napi_ok || !is_buffer) return nullptr;

    size_t length;
    char* data;
    status = napi_get_buffer_info(env, args[0], (void**)&data, &length);
    if (status != napi_ok) return nullptr;

    if (length < MAGIC_LEN + IV_LEN + 16 || length % 16 != (MAGIC_LEN + IV_LEN) % 16) {
        napi_throw_type_error(env, nullptr, "Invalid encrypted buffer length");
        return nullptr;
    }
    if (memcmp(data, MAGIC, MAGIC_LEN) != 0) {
        napi_throw_type_error(env, nullptr, "Not CXENC encrypted buffer");
        return nullptr;
    }

    const uint8_t* iv = (const uint8_t*)(data + MAGIC_LEN);
    size_t cipher_len = length - MAGIC_LEN - IV_LEN;
    if (cipher_len % 16 != 0) {
        napi_throw_type_error(env, nullptr, "Cipher length not multiple of 16");
        return nullptr;
    }

    std::string out;
    out.resize(cipher_len);
    memcpy(&out[0], data + MAGIC_LEN + IV_LEN, cipher_len);

    struct AES_ctx ctx;
    AES_init_ctx_iv(&ctx, AES_KEY, iv);
    AES_CBC_decrypt_buffer(&ctx, (uint8_t*)&out[0], cipher_len);

    /* Strip PKCS7 padding */
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
    napi_value fn;
    napi_create_function(env, "decrypt", NAPI_AUTO_LENGTH, Decrypt, nullptr, &fn);
    napi_set_named_property(env, exports, "decrypt", fn);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
