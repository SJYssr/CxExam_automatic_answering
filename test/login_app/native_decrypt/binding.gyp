{
  "targets": [{
    "target_name": "decrypt",
    "sources": [ "decrypt.cc", "aes.c" ],
    "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
    "conditions": [
      ["OS=='win'", {
        "msvs_settings": { "VCCLCompilerTool": { "ExceptionHandling": 1 } },
        "defines": [ "NOMINMAX" ]
      }]
    ]
  }]
}
