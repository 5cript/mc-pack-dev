#include "update_agent.hpp"
#include "sha256.hpp"

#include <fmt/ranges.h>

#include <algorithm>
#include <iterator>
#include <set>
#include <iostream>

namespace 
{

std::filesystem::path getBasePath(std::filesystem::path const& selfDirectory)
{
#ifdef NDEBUG
    return selfDirectory / "client";
#else
    return selfDirectory.parent_path().parent_path().parent_path() / "dummy_dir" / "client";
#endif
}

}

//#####################################################################################################################
UpdateAgent::UpdateAgent(std::filesystem::path const& selfDirectory)
    : selfDirectory_{selfDirectory}
    , localMods_{}
{
    try
    {    
        const auto basePath = getBasePath(selfDirectory_);
        std::filesystem::directory_iterator mods{basePath / "mods"}, end;

        for (; mods != end; ++mods)
        {
            localMods_.push_back(mods->path());
        }
    }
    catch(const std::exception& e)
    {
        std::cout << e.what() << '\n';
        exit(1);
    }
}
//---------------------------------------------------------------------------------------------------------------------
std::filesystem::path UpdateAgent::getModPath(std::string const& name)
{
    return getBasePath(selfDirectory_) / "mods" / name;
}
//---------------------------------------------------------------------------------------------------------------------
UpdateInstructions UpdateAgent::buildDifference(std::vector <UpdateFile> const& remoteFiles) const
{
    std::set <std::string> remoteSet, localSet;
    std::transform(
        std::begin(remoteFiles), 
        std::end(remoteFiles), 
        std::inserter(remoteSet, std::end(remoteSet)), 
        [](auto const& element){
            return element.path.string();
        }
    );
    std::transform(
        std::begin(localMods_), 
        std::end(localMods_), 
        std::inserter(localSet, std::end(localSet)), 
        [](auto const& element){
            return element.filename().string();
        }
    );

    std::set <std::string> equal;
    std::vector <std::string> fresh, old;
    std::set_difference(
        std::begin(remoteSet), 
        std::end(remoteSet), 
        std::begin(localSet), 
        std::end(localSet),
        std::inserter(old, std::end(old))
    );
    std::set_difference(
        std::begin(localSet), 
        std::end(localSet),
        std::begin(remoteSet), 
        std::end(remoteSet),
        std::inserter(fresh, std::end(fresh)) 
    );
    std::set_intersection(
        std::begin(localSet), 
        std::end(localSet),
        std::begin(remoteSet), 
        std::end(remoteSet), 
        std::inserter(equal, std::end(equal))
    );

    const auto basePath = getBasePath(selfDirectory_);
    for (auto const& remote : remoteFiles)
    {
        if (equal.find(remote.path.string()) != std::end(equal) && !remote.sha256.empty() && sha256(basePath / "mods" / remote.path.string()) != remote.sha256)
        {
            fresh.push_back(remote.path.string());
            old.push_back(remote.path.string());
        }
    }

    fmt::print("FRESH\n{}\n\n\n", fresh);
    fmt::print("OUTDATED\n{}\n", old);

    return UpdateInstructions{
        .download = fresh,
        .remove = old
    };
}
//#####################################################################################################################