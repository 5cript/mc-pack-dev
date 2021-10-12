#include "routers/update_api.hpp"

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
    http_server server(context.get_io_service(), [](auto*, auto const&, auto const&){});

    // start server on port 80. Numbers are also valid
    server.start(std::to_string(port), "::");

    std::filesystem::path self{argv[0]};
    UpdateApi updateApi{server, self.parent_path()};

    std::cin.get();
}