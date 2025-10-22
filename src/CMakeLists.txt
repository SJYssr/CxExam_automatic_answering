set(CMAKE_LIBRARY_PATH "E:/CMake/Detours/lib.X86")
set(CMAKE_INCLUDE_PATH "E:/CMake/Detours/include")

# ��ʽ����·��
set(DETOURS_INCLUDE_DIRS "E:/CMake/Detours/include")
set(DETOURS_LIBRARY "E:/CMake/Detours/lib.X86/detours.lib")

file(GLOB SOURCES "*.cpp" "*.c")
file(GLOB RESOURCES "*.rc")
add_library(CefHook SHARED ${SOURCES} ${RESOURCES})
set_target_properties(CefHook PROPERTIES 
    LINKER_LANGUAGE C
    OUTPUT_NAME "winmm"
    PREFIX ""
)
target_include_directories(CefHook PRIVATE ${DETOURS_INCLUDE_DIRS})
target_link_libraries(CefHook PRIVATE ${DETOURS_LIBRARY})
