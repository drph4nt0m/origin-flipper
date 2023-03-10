/* eslint-disable @typescript-eslint/no-var-requires */
const CopyPlugin = require("copy-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src");

const fileExtensions = ["jpg", "jpeg", "png", "gif", "eot", "otf", "svg", "ttf", "woff", "woff2"];

module.exports = {
    mode: "production",
    devtool: "inline-source-map",
    entry: {
        "../worker": path.join(srcDir, "./worker.ts"),
        "../popup": path.join(srcDir, "./popup.ts")
    },
    output: {
        path: path.join(__dirname, "../dist/js"),
        filename: "[name].js"
    },
    module: {
        rules: [
            {
                test: /\.ts$/i,
                use: "ts-loader",
                exclude: /node_modules/
            },
            {
                test: new RegExp(".(" + fileExtensions.join("|") + ")$"),
                loader: "file-loader",
                options: {
                    name: "../assets/[contenthash].[ext]"
                },
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        modules: [path.resolve("./node_modules"), path.resolve("./src")],
        extensions: [".ts", ".js"],
        plugins: [new TsconfigPathsPlugin()]
    },
    plugins: [
        new CopyPlugin({
            patterns: [{ from: ".", to: "../", context: "public" }],
            options: {}
        })
    ],
    experiments: {
        topLevelAwait: true
    }
};
