#pragma once

#include <filesystem>
#include <string>
#include <vector>

struct UpdateFile
{
    std::filesystem::path path;
    std::string sha256;
};

struct UpdateInstructions
{
    std::vector <std::string> download;
    std::vector <std::string> remove;
};

class UpdateAgent
{
public:
    UpdateAgent(std::filesystem::path const& selfDirectory);

    UpdateInstructions buildDifference(std::vector <UpdateFile> const& remoteFiles);
    std::filesystem::path getModPath(std::string const& name);
    bool installMods(std::string const& tarFile);

private:
    void loadLocalMods();

private:
    std::filesystem::path selfDirectory_;
    std::vector <std::filesystem::path> localMods_;
};