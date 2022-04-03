cmake_minimum_required (VERSION 3.21)

# Project
project(update-client)

file(MAKE_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

add_subdirectory(attendee)
add_subdirectory(main)
add_subdirectory(FTXUI)
