#pragma once

#include "config.hpp"
#include "updater_server/sha256.hpp"

#include <nlohmann/json.hpp>

#include <string>
#include <filesystem>
#include <vector>
#include <functional>

struct HashedMod
{
    std::filesystem::path path;
    std::string name;
    std::string hash;
};

struct UpdateInstructions
{
    std::vector <std::string> download;
    std::vector <std::string> remove;
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(HashedMod, name, hash)
NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(UpdateInstructions, download, remove)

class UpdateClient
{
public:
    struct ProgressCallbacks
    {
        std::function<void(int, int, std::string const&)> onDownloadProgress;
    };

public:
    UpdateClient(std::filesystem::path selfDirectory, std::string remoteAddress, unsigned short port);
    void performUpdate(Config const& conf, ProgressCallbacks const& cbs);

private:
    void updateMods();
    std::string url(std::string const& path) const;
    std::vector <HashedMod> loadLocalMods();
    void removeOldMods(std::vector <std::string> const& removalList);
    void downloadMods(std::vector <std::string> const& downloadList);
    void installFabric() const;

private:
    Config conf_;
    ProgressCallbacks cbs_;
    std::filesystem::path selfDirectory_;
    std::string remoteAddress_;
    unsigned short port_;
};