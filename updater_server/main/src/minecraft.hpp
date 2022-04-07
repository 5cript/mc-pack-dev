#pragma once

#ifndef __kernel_entry
#define __kernel_entry
#endif
#include <boost/process.hpp>

#include <memory>
#include <csignal>
#include <iostream>

class Minecraft
{
public:
    Minecraft();
    void start();
    bool stop(int waitTimeoutSeconds = 60);
    void forwardIo();

private:
    std::unique_ptr<boost::process::child> process_;
    boost::asio::streambuf inputBuffer_;
};
