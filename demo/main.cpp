/* OpenGL 3.3+
* Build with:
 *   g++ -o app main.cpp -lglad -lglfw -lGL (Linux)
 *   cl main.cpp glad.c glfw3.lib opengl32.lib (Windows MSVC)
 */
#include "gl_template.h"
#include "assets.h"

int main() {
    // Configure window
    GLTemplate::Config config;
    config.width = 800;
    config.height = 600;
    config.title = "OpenGL Asset Viewer";
    config.clearColor[0] = 0.1f;
    config.clearColor[1] = 0.1f;
    config.clearColor[2] = 0.15f;
    config.clearColor[3] = 1.0f;

    // Initialize OpenGL context and shaders
    if (!GLTemplate::init(config)) {
        return -1;
    }

    // Initialize all shapes from generated header
     Assets::initAllShapes();

    // Render loop
    while (!GLTemplate::shouldClose()) {
        GLTemplate::beginFrame();

        // Option 1: Draw all shapes at once
        Assets::drawAll();
        GLTemplate::endFrame();
    }

    // Cleanup
    Assets::cleanup();  // Cleanup generated shapes

    GLTemplate::cleanup();
    return 0;
}
