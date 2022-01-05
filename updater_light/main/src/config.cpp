#include "config.hpp"
#include "base_path.hpp"

#include <fstream>

using json = nlohmann::json;

Config loadConfig(std::filesystem::path const& selfDirectory)
{
    std::ifstream reader{getBasePath(selfDirectory) / "updater.json", std::ios_base::binary};
    if (!reader.good())
        return {};
    json j;
    reader >> j;
    Config conf;
    j.get_to(conf);
    return conf;
}