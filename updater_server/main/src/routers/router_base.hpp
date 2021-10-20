#include <attender/http/response.hpp>
#include <attender/http/request.hpp>

#include <iostream>

inline void enable_cors(attender::request_handler* req, attender::response_handler* res, std::string const& originString = "*")
{
    auto origin = req->get_header_field("Origin");
    if (origin)
    {
        res->set("Access-Control-Allow-Origin", origin.value());
    }
    else
    {
        res->set("Access-Control-Allow-Origin", originString);
    }
    res->set("Access-Control-Allow-Methods", "GET,PUT,POST,HEAD,OPTIONS");
    res->set("Access-Control-Allow-Credentials", "true");
    res->set("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

template <typename T>
inline void cors_options(T& server, std::string const& path, std::string const& allow, std::string const& originString = "*")
{
    server.options(path, [allow, originString, path](auto req, auto res)
    {
        std::cout << "Preflight request for " << path << "\n";
        res->set("Allow", allow + ", OPTIONS");
        res->set("Connection", "keep-alive");
        enable_cors(req, res, originString);
        res->status(204).end();
    });
}