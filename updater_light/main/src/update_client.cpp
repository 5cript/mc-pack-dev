#include "update_client.hpp"
#include "base_path.hpp"

#include <attendee/attendee.hpp>
#include <attendee/sources/string_source.hpp>
#include <nlohmann/json.hpp>

#include <iostream>

using json = nlohmann::json;
using namespace std::string_literals;

UpdateClient::UpdateClient(std::filesystem::path selfDirectory, std::string remoteAddress, unsigned short port)
    : selfDirectory_{std::move(selfDirectory)}
    , remoteAddress_{std::move(remoteAddress)}
    , port_{port}
{
}

void UpdateClient::performUpdate(Config const& conf, ProgressCallbacks const& cbs)
{
    conf_ = conf;
    cbs_ = cbs;
    updateMods();
}

void UpdateClient::installFabric() const
{
    
}

void UpdateClient::updateMods()
{
    attendee::request req;
    std::string response;
    req
        .set_header_fields({
            {"Expect", ""}
        })
        .make_source<attendee::string_source>(json{{"mods",  loadLocalMods()}}.dump())
        .post(url("/make_file_difference"), false)
        .sink(response)
        .perform()
    ;
    UpdateInstructions instructions;
    json::parse(response).get_to(instructions);

    removeOldMods(instructions.remove);
    downloadMods(instructions.download);
}

std::vector <HashedMod> UpdateClient::loadLocalMods()
{
    try
    {    
        const auto modsDirectory = getBasePath(selfDirectory_) / clientDirectory / modsDirName;
        std::filesystem::directory_iterator mods{modsDirectory}, end;
        std::vector <HashedMod> localMods;

        for (; mods != end; ++mods)
        {
            if (conf_.ignoreMods.find(mods->path().filename().string()) == conf_.ignoreMods.end())
                localMods.push_back({
                    .path = mods->path(),
                    .name = mods->path().filename().string(),
                    .hash = sha256FromFile(mods->path())
                });
        }
        return localMods;
    }
    catch(const std::exception& e)
    {
        std::cout << e.what() << '\n';
        exit(1);
    }    
}

void UpdateClient::removeOldMods(std::vector <std::string> const& removalList)
{
    const auto modsDirectory = getBasePath(selfDirectory_) / clientDirectory / modsDirName;
    for (auto const& remove : removalList)
        std::filesystem::remove(modsDirectory / remove);
}

void UpdateClient::downloadMods(std::vector <std::string> const& downloadList)
{
    const auto modsDirectory = getBasePath(selfDirectory_) / clientDirectory / modsDirName;
    cbs_.onDownloadProgress(0, downloadList.size(), "No File");
    int i = 0;
    for (auto const& download : downloadList)
    {
        attendee::request req;
        std::ofstream writer{modsDirectory / download, std::ios_base::binary};
        cbs_.onDownloadProgress(1 + i++, downloadList.size(), download);
        req
            .get(url("/download_mod/"s + attendee::request::url_encode(download)))
            .sink([&writer](char const* buf, std::size_t count){
                writer.write(buf, count);
            })
            .perform()
        ;
    }
}

std::string UpdateClient::url(std::string const& path) const
{
    return "http://"s + remoteAddress_ + ":" + std::to_string(port_) + path;
}