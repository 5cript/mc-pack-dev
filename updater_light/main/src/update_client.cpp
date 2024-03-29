#include "update_client.hpp"
#include "base_path.hpp"

#include <attendee/attendee.hpp>
#include <attendee/sources/string_source.hpp>
#include <nlohmann/json.hpp>

#include <boost/property_tree/ptree.hpp>
#include <boost/property_tree/xml_parser.hpp>
#include <boost/process.hpp>

#include <iostream>
#include <sstream>
#include <chrono>

using json = nlohmann::json;
using namespace std::string_literals;
using namespace std::chrono_literals;

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

    installFabric();
    updateMods();
}

void UpdateClient::installFabric()
{
    attendee::request req;
    std::string response;
    const auto res = req
        .sink(response)
        .get(url("/versions"))
        .perform()
    ;
    Versions versions;
    if (res.code() != 200) 
    {
        std::cout << "Could not connect to update server.\n";
        std::cin.get();
        throw std::runtime_error("Connection failed");
    }
    try 
    {
        json::parse(response).get_to(versions);
    }
    catch(std::exception const& exc)
    {
        std::cout << "Could not parse versions response: " << exc.what() << "\n";
        std::cout << response << "\n";
        std::rethrow_exception(std::current_exception());
    }

    if ((versions.fabricVersion != conf_.fabricVersion || versions.minecraftVersion != conf_.minecraftVersion) && cbs_.onFabricInstall())
    {
        const auto clientDir = getBasePath(selfDirectory_) / clientDirectory;

        std::string metadata;
        attendee::request req2;
        if (int res = req2
            .sink(metadata)
            .verify_peer(false)
            .get("https://maven.fabricmc.net/net/fabricmc/fabric-installer/maven-metadata.xml")
            .perform()
            .result(); res != 0
        ){
            std::cout << "Could not load fabric installer version metadata " << res <<"\n";
            return;
        }

        namespace pt = boost::property_tree;
        pt::ptree tree;
        std::stringstream metadataStream{metadata};
        pt::read_xml(metadataStream, tree);
        const auto latestInstallerVersion = tree.get<std::string>("metadata.versioning.latest");
        std::cout << "Download latest installer " << tree.get<std::string>("metadata.versioning.latest") << "\n";

        const auto installerFile = clientDir / "installer.jar";
        std::ofstream writer{installerFile, std::ios_base::binary};
        attendee::request reqInst;
        if (int res = reqInst
            .sink([&writer](auto const* buf, std::size_t amount){
                writer.write(buf, amount);
            })
            .verify_peer(false)
            .get("https://maven.fabricmc.net/net/fabricmc/fabric-installer/" + latestInstallerVersion + "/fabric-installer-" + latestInstallerVersion + ".jar")
            .perform()
            .result(); res != 0)
        {
            std::cout << "Could not download fabric installer " << res << "\n";
            return;
        }
        writer.close();

        auto javaPath = findJava();
        if (!javaPath)
            return;
        std::cout << "Calling fabric installer into " << clientDir.string() << "\n";
        const auto invocation =
            javaPath->string() 
                + " -jar \"" 
                + installerFile.string() 
                + "\" client -mcversion " 
                + versions.minecraftVersion 
                + " -dir \""
                + clientDir.string()
                + "\" -downloadMinecraft"
                + " -loader "
                + versions.fabricVersion
        ;

        boost::process::child installer{      
            invocation,
            boost::process::std_out > stdout, 
            boost::process::std_err > stderr,
        };
        installer.wait_for(30s);
        conf_.minecraftVersion = versions.minecraftVersion;
        conf_.fabricVersion = versions.fabricVersion;
        saveConfig(selfDirectory_, conf_);
    }
    else 
    {
        std::cout << "Fabric and Minecraft installation are up to date\n";
    }
}

std::optional<std::filesystem::path> UpdateClient::findJava() const
{
    const auto clientDir = getBasePath(selfDirectory_) / clientDirectory;
    auto path = clientDir / "runtime";
    if (!std::filesystem::exists(path))
    {
        std::cout << "Runtime is not installed. Please start minecraft launcher once here.\n";
        return std::nullopt;
    }
    // decends further into the first found directory:
    path = std::filesystem::directory_iterator{path}->path();
    path = std::filesystem::directory_iterator{path}->path();
    std::filesystem::directory_iterator anyIter{path}, end;
    for (; anyIter != end; ++anyIter)
    {
        if (std::filesystem::is_directory(anyIter->status()))
        {
            path = anyIter->path();
            break;
        }
    }
    if (anyIter == end)
    {
        std::cout << "Could not decend into runtime directory structure.\n";
        return std::nullopt;
    }
    if (std::filesystem::exists(path / "bin" / "java.exe"))
        path = path / "bin" / "java.exe";
    else
        path = path / "bin" / "java";
    return path;
}

void UpdateClient::updateMods()
{
    attendee::request req;
    std::string response;
    std::cout << "Getting minecraft mod file list...\n";
    req
        .set_header_fields({
            {"Expect", ""}
        })
        .make_source<attendee::string_source>(json{{"mods", loadLocalMods()}}.dump())
        .post(url("/make_file_difference"), false)
        .sink(response)
        .perform()
    ;
    std::cout << "List was obtained.\n";
    UpdateInstructions instructions;    
    try 
    {
        json::parse(response).get_to(instructions);
    }
    catch(std::exception const& exc)
    {
        std::cout << "Could not parse make_file_difference response: " << exc.what() << "\n";
        std::cout << response << "\n";
        std::rethrow_exception(std::current_exception());
    }

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