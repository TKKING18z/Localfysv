# Localfy Development Guidelines

## Build Commands
- `npm start` or `expo start` - Start the development server
- `npm run ios` - Start the development server for iOS
- `npm run android` - Start the development server for Android
- `npm run web` - Start the development server for web

## Code Style Guidelines
- **Imports**: Group imports by type (React/RN, Navigation, Components, Context, Utils)
- **Naming**: Use PascalCase for components, camelCase for variables/functions
- **Types**: Use TypeScript interfaces/types for all components and functions
- **State Management**: Use React Context for global state
- **Error Handling**: Use try/catch blocks with specific error messages
- **Async/Await**: Prefer async/await over Promise chains
- **Components**: Organize by feature, use memo/callbacks for performance
- **Formatting**: 2-space indentation, trailing commas, 100-char line limit
- **File Structure**: Group related files by feature in subdirectories
- **Comments**: Add JSDoc comments for complex functions
- **Firebase**: Always handle errors in service calls, use helper functions

## Service Pattern
- Business logic should be in service files (e.g., services/ChatService.ts)
- Use result objects with `success` and optional `data`/`error` properties