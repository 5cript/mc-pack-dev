# Version check
cmake_minimum_required (VERSION 3.20)

if (NOT EXISTS ${CMAKE_BINARY_DIR}/CMakeCache.txt)
  if (NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE "Release" CACHE STRING "" FORCE)
  endif()
endif()

# Add exec
add_executable(${PROJECT_NAME} 
    "src/main.cpp"
    "src/update_client.cpp"
    "src/config.cpp"
)

set_property(TARGET ${PROJECT_NAME} PROPERTY CXX_STANDARD 20)

# Compiler Options
set(DEBUG_OPTIONS -fexceptions -g -Wall -pedantic-errors -pedantic)
set(RELEASE_OPTIONS -fexceptions -O3 -Wall -pedantic-errors -pedantic)
target_compile_options(${PROJECT_NAME} PUBLIC "$<$<CONFIG:DEBUG>:${DEBUG_OPTIONS}>")
target_compile_options(${PROJECT_NAME} PUBLIC "$<$<CONFIG:RELEASE>:${RELEASE_OPTIONS}>")

target_include_directories(${PROJECT_NAME} PUBLIC "../../updater_server/main/include")

# Linking
target_link_libraries(${PROJECT_NAME} PUBLIC screen dom component attendee ssl crypto fmt)
if (UNIX)
    target_link_libraries(${PROJECT_NAME} PUBLIC pthread atomic)
endif (UNIX)

if ("${CMAKE_CXX_COMPILER_ID}" STREQUAL "Clang")
  target_link_libraries(${PROJECT_NAME} PUBLIC "libc++")
else()
  target_link_libraries(${PROJECT_NAME} PUBLIC "-lstdc++ -lgcc")
endif()

#target_link_options(${PROJECT_NAME} PUBLIC "$<$<CONFIG:RELEASE>:-s>" "$<$<CONFIG:RELEASE>:-static-libstdc++>" "$<$<CONFIG:RELEASE>:-static-libgcc>")