# Research: Integrating UI Designs

This document outlines the decisions made for converting the static HTML designs into dynamic React components for the Timelock Manager application.

## 1. UI Componentization Strategy

- **Decision**: Each `code.html` file within the `ui-design-files` subdirectories will be converted into a primary React component. The subdirectories (e.g., `dashboard`, `decoder`) represent distinct pages or views within the application.
- **Rationale**: The provided HTML is static and not directly usable in a Next.js application. It must be re-implemented using React components to allow for dynamic data, state management, and interactivity. A one-to-one mapping from each `code.html` to a page component is the most direct translation of the provided designs.
- **Alternatives Considered**:
  - _Directly rendering HTML_: This is not feasible as it would prevent any form of interactivity or dynamic data binding required by the application.
  - _Using iframes_: This would isolate the designs from the main application, making communication and state sharing difficult and inefficient.

## 2. Styling Approach

- **Decision**: Tailwind CSS will be used to style the new components. The class names and styles from the static HTML files will be mapped to Tailwind's utility classes. The project already has `tailwind.config.ts` configured, and this approach will maintain consistency.
- **Rationale**: The project is already set up with Tailwind CSS. Using it ensures a consistent design system, reduces CSS bundle size, and aligns with existing development patterns. Manually transcribing styles into utility classes allows for cleanup and adherence to the project's design tokens.
- **Alternatives Considered**:
  - _Global CSS_: Creating separate CSS files for each component would go against the project's established styling methodology and could lead to class name collisions and larger CSS files.
  - _CSS-in-JS_: While an option, it would introduce a new styling paradigm to a project that has already standardized on Tailwind.

## 3. Asset Management

- **Decision**: Any images, fonts, or other static assets referenced by the designs will be moved into the `/public` directory of the Next.js application. The `screen.png` files will be used for visual reference during development but will not be included in the final build.
- **Rationale**: The Next.js `/public` directory is the standard location for serving static assets. This ensures they are correctly processed and served by the web server.
- **Alternatives Considered**:
  - _Keeping assets in `ui-design-files`_: This would require a custom build step to copy the files and would be contrary to Next.js conventions.

## 4. State Management and Data Binding

- **Decision**: Existing hooks and services will be used to provide data to the newly created components. The responsibility of the UI integration task is to connect these existing data sources to the new presentation layer.
- **Rationale**: The feature specification focuses on replacing the view layer. It assumes that the underlying data logic is already in place. This decision respects the scope of the task.
- **Alternatives Considered**:
  - _Creating new data hooks_: This is out of scope. If new data is required, it should be addressed as a separate feature or task.
