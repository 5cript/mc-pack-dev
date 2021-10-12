#pragma once

#include <openssl/sha.h>

#include <filesystem>
#include <fstream>
#include <cstring>

static std::string sha256(std::filesystem::path const& source)
{
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX sha256;
    SHA256_Init(&sha256);

    std::ifstream reader{source, std::ios_base::binary};
    if (!reader.good())
    {
        throw std::runtime_error("could not open file to generate hash");
    }
    std::string buffer;
    buffer.resize(4096);
    do 
    {
        reader.read(buffer.data(), buffer.size());
        SHA256_Update(&sha256, buffer.c_str(), reader.gcount());
    } while(static_cast <std::size_t>(reader.gcount()) == buffer.size());
    
    SHA256_Final(hash, &sha256);

    std::string str;
    str.resize(SHA256_DIGEST_LENGTH + 1);
    std::memcpy(str.data(), hash, SHA256_DIGEST_LENGTH);
    return str;
}