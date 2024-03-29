#pragma once

#include "../update_agent.hpp"
#include "../minecraft.hpp"

#include <attender/http/http_server.hpp>

#include <filesystem>

class UpdateApi
{
public:
    UpdateApi(attender::http_server& server, std::filesystem::path const& selfDirectory, Minecraft* minecraft);

private:
    void addHttpEndpoints(attender::http_server& server);

private:
    UpdateAgent agent_;
    Minecraft* minecraft_;
};