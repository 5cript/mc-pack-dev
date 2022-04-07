#include "routers/update_api.hpp"
#include "minecraft.hpp"

#include <iostream>

#include <attender/io_context/managed_io_context.hpp>
#include <attender/io_context/thread_pooler.hpp>

constexpr int port = 25002;

int main(int argc, char** argv)
{
    using namespace attender;
    managed_io_context <thread_pooler> context;

    std::cout << "Running on: " << port << "\n";

    // create a server
    http_server server(context.get_io_context(), [](auto*, auto const&, auto const&){});

    // start server on port 80. Numbers are also valid
    server.start(std::to_string(port), "::");

    Minecraft minecraft{};
    UpdateApi updateApi{server, std::filesystem::path{argv[0]}.parent_path(), &minecraft};

    if (argc > 1 && std::string{argv[1]} != "--nostart") {
        minecraft.start();
        minecraft.forwardIo();
        minecraft.stop();
    }

    std::cin.get();
}