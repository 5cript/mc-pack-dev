#include "update_client.hpp"
#include "config.hpp"

#include <ftxui/dom/elements.hpp>
#include <ftxui/screen/screen.hpp>
#include <ftxui/screen/string.hpp>

#include <iostream>
#include <thread>
#include <chrono>

using namespace std::chrono_literals;

int main(int argc, char** argv)
{
    auto selfPath = std::filesystem::path{argv[0]}.parent_path();

    using namespace ftxui;

    auto config = loadConfig(selfPath);
 
    std::string resetPosition;
    UpdateClient client{selfPath, config.updateServerIp, config.port};
    client.performUpdate(
        config,
        {
            .onDownloadProgress = [&resetPosition](int current, int total, std::string const& currentName)
            {
                const auto progress = total == 0 ? 1 : static_cast <double>(current) / (total == 0 ? 1 : total);
                auto document =
                    vbox({
                        text(currentName),
                        hbox({
                            gauge(progress) | flex,
                            text(" " + std::to_string(current) + "/" + std::to_string(total))
                        })
                    })
                ;
                auto screen = Screen(100, 2);
                Render(screen, document);
                std::cout << resetPosition;
                screen.Print();
                resetPosition = screen.ResetPosition();
                std::this_thread::sleep_for(0.01s);
            }
        }
    );

    std::cout << std::endl;
}