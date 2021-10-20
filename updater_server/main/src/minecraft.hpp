#pragma once

#include <boost/process.hpp>

#include <memory>
#include <csignal>
#include <iostream>

class Minecraft
{
public:
    void start()
    {
        process_ = std::make_unique<boost::process::child>(
            "java -jar ./fabric-server-launch.jar"
        );
    }
    bool stop(int waitTimeoutSeconds = 60)
    {
        kill(process_->id(), SIGINT);
        for (int i = 0; i != waitTimeoutSeconds; ++i)
        {
            std::cout << "Waiting for " << i << " seconds for minecraft to shutdown...\n";
            if (process_->wait_for(std::chrono::seconds(1)))
            {
                return true;
            }
        }        
        return false;
    }

private:
    std::unique_ptr<boost::process::child> process_;
};
