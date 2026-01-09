/*
 * gl_template.h - OpenGL 3.3+ Template Header
 * 
 * This header provides a simple template for OpenGL applications with:
 * - GLFW window creation and management
 * - Shader compilation utilities
 * - Vertex color support (position + RGBA)
 * 
 * Usage:
 *   1. Include this header
 *   2. Include your generated assets header (e.g., assets.h)
 *   3. Call GLTemplate::init() to create window and compile shaders
 *   4. In render loop, call GLTemplate::beginFrame(), draw your shapes, then GLTemplate::endFrame()
 *   5. Call GLTemplate::cleanup() before exiting
 */

#ifndef GL_TEMPLATE_H
#define GL_TEMPLATE_H

#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include <string>

namespace GLTemplate {

    // Configuration
    struct Config {
        int width = 800;
        int height = 600;
        const char* title = "OpenGL Application";
        float clearColor[4] = {0.1f, 0.1f, 0.15f, 1.0f};
    };

    // Global state
    inline GLFWwindow* window = nullptr;
    inline unsigned int shaderProgram = 0;
    inline Config config;

    // Default shaders for position (vec2) + color (vec4)
    inline const char* defaultVertexShader = R"(
        #version 330 core
        layout (location = 0) in vec2 aPos;
        layout (location = 1) in vec4 aColor;
        out vec4 vertexColor;
        void main() {
            gl_Position = vec4(aPos.x, aPos.y, 0.0, 1.0);
            vertexColor = aColor;
        }
    )";

    inline const char* defaultFragmentShader = R"(
        #version 330 core
        out vec4 FragColor;
        in vec4 vertexColor;
        void main() {
            FragColor = vertexColor;
        }
    )";

    // Compile a shader from source
    inline unsigned int compileShader(GLenum type, const char* source) {
        unsigned int shader = glCreateShader(type);
        glShaderSource(shader, 1, &source, NULL);
        glCompileShader(shader);

        int success;
        char infoLog[512];
        glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
        if (!success) {
            glGetShaderInfoLog(shader, 512, NULL, infoLog);
            std::cerr << "ERROR::SHADER::" 
                      << (type == GL_VERTEX_SHADER ? "VERTEX" : "FRAGMENT")
                      << "::COMPILATION_FAILED\n" << infoLog << std::endl;
        }
        return shader;
    }

    // Create shader program from vertex and fragment sources
    inline unsigned int createShaderProgram(const char* vertexSrc, const char* fragmentSrc) {
        unsigned int vertexShader = compileShader(GL_VERTEX_SHADER, vertexSrc);
        unsigned int fragmentShader = compileShader(GL_FRAGMENT_SHADER, fragmentSrc);

        unsigned int program = glCreateProgram();
        glAttachShader(program, vertexShader);
        glAttachShader(program, fragmentShader);
        glLinkProgram(program);

        int success;
        char infoLog[512];
        glGetProgramiv(program, GL_LINK_STATUS, &success);
        if (!success) {
            glGetProgramInfoLog(program, 512, NULL, infoLog);
            std::cerr << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << std::endl;
        }

        glDeleteShader(vertexShader);
        glDeleteShader(fragmentShader);

        return program;
    }

    // Framebuffer size callback
    inline void framebufferSizeCallback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
    }

    // Initialize GLFW, create window, load GLAD, compile default shaders
    inline bool init(const Config& cfg = Config()) {
        config = cfg;

        // Initialize GLFW
        if (!glfwInit()) {
            std::cerr << "Failed to initialize GLFW" << std::endl;
            return false;
        }

        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        #ifdef __APPLE__
        glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
        #endif

        // Create window
        window = glfwCreateWindow(config.width, config.height, config.title, NULL, NULL);
        if (!window) {
            std::cerr << "Failed to create GLFW window" << std::endl;
            glfwTerminate();
            return false;
        }

        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);

        // Load GLAD
        if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
            std::cerr << "Failed to initialize GLAD" << std::endl;
            return false;
        }

        // Compile default shaders
        shaderProgram = createShaderProgram(defaultVertexShader, defaultFragmentShader);

        return true;
    }

    // Check if window should close
    inline bool shouldClose() {
        return glfwWindowShouldClose(window);
    }

    // Process input (ESC to close)
    inline void processInput() {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, true);
        }
    }

    // Begin frame - clear screen and use shader
    inline void beginFrame() {
        processInput();
        glClearColor(config.clearColor[0], config.clearColor[1], config.clearColor[2], config.clearColor[3]);
        glClear(GL_COLOR_BUFFER_BIT);
        glUseProgram(shaderProgram);
    }

    // End frame - swap buffers and poll events
    inline void endFrame() {
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // Cleanup resources
    inline void cleanup() {
        if (shaderProgram) {
            glDeleteProgram(shaderProgram);
            shaderProgram = 0;
        }
        glfwTerminate();
    }

} // namespace GLTemplate

#endif // GL_TEMPLATE_H
