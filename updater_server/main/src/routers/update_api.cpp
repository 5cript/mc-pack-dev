#include "update_api.hpp"
#include "router_base.hpp"
#include "../sha256.hpp"

#include <attender/http/response.hpp>
#include <attender/http/request.hpp>
#include <nlohmann/json.hpp>

#include <iostream>

using json = nlohmann::json;

UpdateApi::UpdateApi(attender::http_server& server, std::filesystem::path const& selfDirectory)
    : agent_{selfDirectory}
{
    addHttpEndpoints(server);
}

void UpdateApi::addHttpEndpoints(attender::http_server& server)
{
    cors_options(server, "/make_file_difference", "GET");
    server.post("/make_file_difference", [this](auto req, auto res) {
        enable_cors(req, res);
        auto content = std::make_shared <std::string>();
        req->read_body(*content).then(
            [content{content}, res, this]() {
                try {
                    if (content->empty())
                    {
                        return res->status(400).type(".txt").send("Expecting an object like: {\"mods\": [{\"name\": \"asdf\", \"hash\": \"asdasd\"}]}");
                    }
                    auto json = json::parse(*content);
                    std::cout << json.dump() << "\n";
                    std::vector <UpdateFile> files;
                    for (auto const& mod : json["mods"])
                    {
                        files.push_back(UpdateFile{
                            .path = mod["name"].get<std::string>(),
                            .sha256 = mod["hash"].get<std::string>()
                        });
                    }
                    auto diff = agent_.buildDifference(files);
                    auto response = "{}"_json; 
                    response["download"] = diff.download;
                    response["remove"] = diff.remove;
                    res->status(200).type(".json").send(response.dump());
                }
                catch(std::exception const& exc)
                {
                    res->status(400).type(".txt").send(exc.what());
                }
            }
        );
    });
    
    server.get("/download_mod/:fileName", [this](auto req, auto res) {
        enable_cors(req, res);
        res->status(200).type(".jar").send_file(agent_.getModPath(req->param("fileName")));
    });
}