#include "update_api.hpp"
#include <updater_server/sha256.hpp>
#include "router_base.hpp"
#include "../temp_file.hpp"

#include <attender/http/response.hpp>
#include <attender/http/request.hpp>
#include <nlohmann/json.hpp>

#include <fstream>
#include <iostream>

using json = nlohmann::json;

UpdateApi::UpdateApi(attender::http_server& server, std::filesystem::path const& selfDirectory, Minecraft* minecraft)
    : agent_{selfDirectory}
    , minecraft_{minecraft}
{
    addHttpEndpoints(server);
}

void UpdateApi::addHttpEndpoints(attender::http_server& server)
{
    cors_options(server, "/make_file_difference", "GET");
    server.post("/make_file_difference", [this](auto req, auto res) {
        enable_cors(req, res);
        auto content = std::make_shared <std::string>();
        std::cout << "Diff Request From: " << req->ipv6Address() << "\n";
        req->read_body(*content).then(
            [content{content}, res, this]() {
                try {
                    std::cout << "Diff body read\n";
                    if (content->empty())
                    {
                        return res->status(400).type(".txt").send("Expecting an object like: {\"mods\": [{\"name\": \"asdf\", \"hash\": \"asdasd\"}]}");
                    }
                    auto json = json::parse(*content);
                    std::vector <UpdateFile> files;
                    for (auto const& mod : json["mods"])
                    {
                        files.push_back(UpdateFile{
                            .path = mod["name"].get<std::string>(),
                            .sha256 = mod["hash"].get<std::string>()
                        });
                    }
                    std::cout << "Building difference\n";
                    auto diff = agent_.buildDifference(files);
                    auto response = "{}"_json; 
                    response["download"] = diff.download;
                    response["remove"] = diff.remove;
                    res->status(200).type(".json").send(response.dump());
                }
                catch(std::exception const& exc)
                {
                    std::cout << "-------------------\n";
                    std::cout << exc.what() << "\n";
                    std::cout << "-------------------\n";
                    std::cout << *content << "\n";
                    std::cout << "-------------------\n";
                    res->status(400).type(".txt").send(exc.what());
                }
            }
        );
    });
    
    server.get("/download_mod/:fileName", [this](auto req, auto res) {
        enable_cors(req, res);
        res->status(200).type(".jar").send_file(agent_.getModPath(req->param("fileName")).string());
    });

    cors_options(server, "/upload_mods", "POST");
    server.post("/upload_mods", [this](auto req, auto res) {
        enable_cors(req, res);
        if (!minecraft_->stop())
        {
            return res->status(500).send("Cannot shutdown minecraft in time");
        }
        agent_.backupWorld();
        auto content = std::make_shared <TempFile>("temp.tar");
        req->read_body(*content).then([content, res, this]() {
            content->close();
            if (!agent_.installMods("temp.tar"))
            {
                return res->status(500).end();
            }
            minecraft_->start();
            res->end();
        });
    });

    server.get("/versions", [this](auto req, auto res) {
        enable_cors(req, res);
        /*
        {
            "fabricVersion": "0.12.12",
            "minecraftVersion": "1.18.1",
        }
        */
        res->status(200).type(".json").send_file(agent_.getFilePath("updater.json").string());
    });
}