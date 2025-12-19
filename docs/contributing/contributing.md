# Contributing Overview

Guide for contributing to Timelock Manager development.

## Welcome Contributors!

Thank you for your interest in contributing to Timelock Manager. This guide will help you understand how to contribute effectively, whether you're fixing bugs, adding features, improving documentation, or suggesting enhancements.

## Ways to Contribute

* **Report bugs**: Help us identify and fix issues
* **Suggest features**: Propose new functionality or improvements
* **Submit code**: Fix bugs or implement features
* **Improve documentation**: Enhance guides and references
* **Review pull requests**: Provide feedback on contributions
* **Share knowledge**: Help other users in discussions

## Contributing Guides

1. [Development Workflow](development-workflow.md) - Git workflow and branching strategy
2. [Code Style](code-style.md) - Coding standards and conventions
3. [Adding Features](adding-features.md) - Guide for implementing new features
4. [Submitting Pull Requests](submitting-prs.md) - PR guidelines and review process

## Quick Start for Contributors

### 1. Set Up Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/your-username/timelock-manager.git
cd timelock-manager

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev
```

### 2. Create a Feature Branch

```bash
# Create branch from main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 3. Make Changes

* Write clean, documented code
* Follow existing code style
* Add tests for new functionality
* Update documentation as needed

### 4. Test Your Changes

```bash
# Run tests
npm test

# Run linter
npm run lint

# Check formatting
npm run format

# Build to verify
npm run build
```

### 5. Submit Pull Request

* Push your branch
* Open PR against `main` branch
* Fill out PR template
* Wait for review

See: [Submitting Pull Requests](submitting-prs.md)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

* **Be respectful**: Treat everyone with respect and kindness
* **Be collaborative**: Work together towards common goals
* **Be professional**: Maintain professional conduct in all interactions
* **Be inclusive**: Welcome contributors of all backgrounds and experience levels

## Development Guidelines

### Code Quality

* **TypeScript**: All code must be type-safe
* **ESLint**: Pass linting without errors
* **Prettier**: Code must be formatted
* **Tests**: New features require tests
* **Documentation**: Public APIs must be documented

### Testing Requirements

* **Unit tests**: For utility functions and hooks
* **Integration tests**: For component interactions
* **Manual testing**: Test in browser before submitting

### Documentation Requirements

* **Code comments**: For complex logic
* **JSDoc**: For public functions and components
* **User guides**: For new user-facing features
* **Architecture docs**: For significant architectural changes

## Branching Strategy

```
main
 ├─ feature/new-feature
 ├─ fix/bug-fix
 ├─ docs/documentation-update
 └─ refactor/code-improvement
```

### Branch Naming

* `feature/description` - New features
* `fix/description` - Bug fixes
* `docs/description` - Documentation updates
* `refactor/description` - Code refactoring
* `chore/description` - Maintenance tasks

See: [Development Workflow](development-workflow.md)

## Commit Messages

### Format

```
type(scope): brief description

Detailed description if needed.

Closes #issue-number
```

### Types

* `feat`: New feature
* `fix`: Bug fix
* `docs`: Documentation changes
* `style`: Code style changes (formatting, etc.)
* `refactor`: Code refactoring
* `test`: Adding or updating tests
* `chore`: Maintenance tasks

### Examples

```bash
git commit -m "feat(operations): add batch operation support"
git commit -m "fix(decoder): handle nested timelock calls correctly"
git commit -m "docs(readme): update installation instructions"
```

## Pull Request Process

### Before Submitting

* [ ] Code follows style guidelines
* [ ] Tests pass locally
* [ ] Lint passes without errors
* [ ] Build succeeds
* [ ] Documentation updated
* [ ] No console errors in browser

### PR Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[Describe how you tested the changes]

## Screenshots
[If applicable, add screenshots]

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks**: CI runs tests and linters
2. **Code review**: Maintainer reviews code
3. **Feedback**: Address review comments
4. **Approval**: Maintainer approves PR
5. **Merge**: PR is merged to main

See: [Submitting Pull Requests](submitting-prs.md)

## Code Style Guide

### TypeScript

```typescript
// Use explicit types
function processOperation(operation: Operation): ProcessedOperation {
  // Implementation
}

// Use interfaces for object shapes
interface OperationFilters {
  status?: OperationStatus
  proposer?: Address
  from?: Date
  to?: Date
}

// Use enums for constants
enum OperationStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED'
}
```

### React Components

```typescript
// Use functional components
export function OperationRow({ operation }: { operation: Operation }) {
  // Component logic
}

// Use hooks for state and effects
const [isExpanded, setIsExpanded] = useState(false)
useEffect(() => {
  // Effect logic
}, [dependency])

// Extract complex logic to custom hooks
const { data, isLoading, error } = useOperations(filters)
```

### File Organization

```
src/components/feature-name/
├── FeatureView.tsx        # Main component
├── FeatureRow.tsx         # Sub-component
├── FeatureModal.tsx       # Sub-component
└── utils.ts               # Feature-specific utilities
```

See: [Code Style](code-style.md)

## Adding New Features

### Process

1. **Discuss**: Open GitHub issue to discuss feature
2. **Design**: Plan architecture and API
3. **Implement**: Write code following guidelines
4. **Test**: Add comprehensive tests
5. **Document**: Update user guides and docs
6. **Submit**: Create pull request

### Checklist for New Features

* [ ] GitHub issue created and discussed
* [ ] Architecture designed and documented
* [ ] Code implemented following style guide
* [ ] Unit tests added
* [ ] Integration tests added
* [ ] User documentation written
* [ ] Architecture documentation updated (if applicable)
* [ ] PR submitted with description

See: [Adding Features](adding-features.md)

## Areas Needing Contribution

### High Priority

* **Test coverage**: Increase test coverage for core features
* **Documentation**: Expand user guides and examples
* **Accessibility**: Improve keyboard navigation and screen reader support
* **Performance**: Optimize large operation lists

### Feature Requests

* **Export functionality**: Export operations to CSV
* **Advanced filtering**: More filtering options
* **Operation templates**: Save and reuse operation configurations
* **Multi-sig support**: Better multi-sig integration

### Good First Issues

Look for issues labeled `good first issue` in the repository. These are beginner-friendly and great for first-time contributors.

## Getting Help

### For Contribution Questions

* **GitHub Discussions**: Ask questions in discussions
* **GitHub Issues**: Report bugs or request features
* **Documentation**: Check existing documentation first

### For Technical Questions

* **Architecture docs**: See [Architecture](../architecture/architecture.md)
* **Developer guide**: See [Developer Guide](../developer-guide/developer-guide.md)
* **Code comments**: Read inline code documentation

## Recognition

Contributors are recognized in:

* **README.md**: Contributors section
* **CHANGELOG.md**: Release notes
* **GitHub**: Contributor badge and profile

Thank you for contributing to Timelock Manager!

## Related Documentation

* **Developer Guide**: [Installation](../developer-guide/installation.md)
* **Architecture**: [Architecture Overview](../architecture/architecture.md)
* **Reference**: [API Endpoints](../reference/api-endpoints.md)
* **Testing**: [Testing Guide](../developer-guide/testing.md)

***

**Start contributing**: [Development Workflow](development-workflow.md) | [Code Style](code-style.md) | [Submitting PRs](submitting-prs.md)
