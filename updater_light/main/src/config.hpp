#pragma once

#include <nlohmann/json.hpp>

#include <set>
#include <string>

struct Config
{
    std::set<std::string> ignoreMods = {};
    std::string updateServerIp = "";
    unsigned short port = 25002;
    std::string fabricVersion = "";
    std::string minecraftVersion = "";
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Config, ignoreMods, updateServerIp, port)

Config loadConfig(std::filesystem::path const& selfDirectory);