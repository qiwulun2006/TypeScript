/* @internal */
namespace ts.JsDoc {
    const jsDocTagNames = [
        "abstract",
        "access",
        "alias",
        "argument",
        "async",
        "augments",
        "author",
        "borrows",
        "callback",
        "class",
        "classdesc",
        "constant",
        "constructor",
        "constructs",
        "copyright",
        "default",
        "deprecated",
        "description",
        "emits",
        "enum",
        "event",
        "example",
        "exports",
        "extends",
        "external",
        "field",
        "file",
        "fileoverview",
        "fires",
        "function",
        "generator",
        "global",
        "hideconstructor",
        "host",
        "ignore",
        "implements",
        "inheritdoc",
        "inner",
        "instance",
        "interface",
        "kind",
        "lends",
        "license",
        "listens",
        "member",
        "memberof",
        "method",
        "mixes",
        "module",
        "name",
        "namespace",
        "override",
        "package",
        "param",
        "private",
        "property",
        "protected",
        "public",
        "readonly",
        "requires",
        "returns",
        "see",
        "since",
        "static",
        "summary",
        "template",
        "this",
        "throws",
        "todo",
        "tutorial",
        "type",
        "typedef",
        "var",
        "variation",
        "version",
        "virtual",
        "yields"
    ];
    let jsDocTagNameCompletionEntries: CompletionEntry[];
    let jsDocTagCompletionEntries: CompletionEntry[];

    export function getJsDocCommentsFromDeclarations(declarations: readonly Declaration[], checker?: TypeChecker): SymbolDisplayPart[] {
        // Only collect doc comments from duplicate declarations once:
        // In case of a union property there might be same declaration multiple times
        // which only varies in type parameter
        // Eg. const a: Array<string> | Array<number>; a.length
        // The property length will have two declarations of property length coming
        // from Array<T> - Array<string> and Array<number>
        const parts: SymbolDisplayPart[][] = [];
        forEachUnique(declarations, declaration => {
            for (const { comment } of getCommentHavingNodes(declaration)) {
                if (comment === undefined) continue;
                const newparts = getDisplayPartsFromComment(comment, checker);
                if (!contains(parts, newparts, isIdenticalListOfDisplayParts)) {
                    parts.push(newparts);
                }
            }
        });
        return flatten(intersperse(parts, [lineBreakPart()]));
    }

    function isIdenticalListOfDisplayParts(parts1: SymbolDisplayPart[], parts2: SymbolDisplayPart[]) {
        if (parts1.length !== parts2.length) {
            return false;
        }
        for (let i = 0; i < parts1.length; i++) {
            if (parts1[i].kind !== parts2[i].kind || parts1[i].text !== parts2[i].text) {
                return false;
            }
        }
        return true;
    }

    function getCommentHavingNodes(declaration: Declaration): readonly (JSDoc | JSDocTag)[] {
        switch (declaration.kind) {
            case SyntaxKind.JSDocParameterTag:
            case SyntaxKind.JSDocPropertyTag:
                return [declaration as JSDocPropertyTag];
            case SyntaxKind.JSDocCallbackTag:
            case SyntaxKind.JSDocTypedefTag:
                return [(declaration as JSDocTypedefTag), (declaration as JSDocTypedefTag).parent];
            default:
                return getJSDocCommentsAndTags(declaration);
        }
    }

    export function getJsDocTagsFromDeclarations(declarations?: Declaration[], checker?: TypeChecker): JSDocTagInfo[] {
        // Only collect doc comments from duplicate declarations once.
        const tags: JSDocTagInfo[] = [];
        forEachUnique(declarations, declaration => {
            for (const tag of getJSDocTags(declaration)) {
                tags.push({ name: tag.tagName.text, text: getCommentDisplayParts(tag, checker) });
            }
        });
        return tags;
    }

    function getDisplayPartsFromComment(comment: readonly (JSDocText | JSDocLink)[], checker: TypeChecker | undefined): SymbolDisplayPart[] {
        return flatMap(
            comment,
            node => node.kind === SyntaxKind.JSDocText ? [textPart(node.text)] : buildLinkParts(node, checker)
        ) as SymbolDisplayPart[];
    }

    function getCommentDisplayParts(tag: JSDocTag, checker?: TypeChecker): SymbolDisplayPart[] | undefined {
        const { comment } = tag;
        switch (tag.kind) {
            case SyntaxKind.JSDocImplementsTag:
                return withNode((tag as JSDocImplementsTag).class);
            case SyntaxKind.JSDocAugmentsTag:
                return withNode((tag as JSDocAugmentsTag).class);
            case SyntaxKind.JSDocTemplateTag:
                return addComment((tag as JSDocTemplateTag).typeParameters.map(tp => tp.getText()).join(", "));
            case SyntaxKind.JSDocTypeTag:
                return withNode((tag as JSDocTypeTag).typeExpression);
            case SyntaxKind.JSDocTypedefTag:
            case SyntaxKind.JSDocCallbackTag:
            case SyntaxKind.JSDocPropertyTag:
            case SyntaxKind.JSDocParameterTag:
            case SyntaxKind.JSDocSeeTag:
                const { name } = tag as JSDocTypedefTag | JSDocPropertyTag | JSDocParameterTag | JSDocSeeTag;
                return name ? withNode(name) : comment && getDisplayPartsFromComment(comment, checker);
            default:
                return comment && getDisplayPartsFromComment(comment, checker);
        }

        function withNode(node: Node) {
            return addComment(node.getText());
        }

        function addComment(s: string) {
            return comment ? [textPart(s), spacePart(), ...getDisplayPartsFromComment(comment, checker)] : [textPart(s)];
        }
    }

    export function getJSDocTagNameCompletions(): CompletionEntry[] {
        return jsDocTagNameCompletionEntries || (jsDocTagNameCompletionEntries = map(jsDocTagNames, tagName => {
            return {
                name: tagName,
                kind: ScriptElementKind.keyword,
                kindModifiers: "",
                sortText: Completions.SortText.LocationPriority,
            };
        }));
    }

    export const getJSDocTagNameCompletionDetails = getJSDocTagCompletionDetails;

    export function getJSDocTagCompletions(): CompletionEntry[] {
        return jsDocTagCompletionEntries || (jsDocTagCompletionEntries = map(jsDocTagNames, tagName => {
            return {
                name: `@${tagName}`,
                kind: ScriptElementKind.keyword,
                kindModifiers: "",
                sortText: Completions.SortText.LocationPriority
            };
        }));
    }

    export function getJSDocTagCompletionDetails(name: string): CompletionEntryDetails {
        return {
            name,
            kind: ScriptElementKind.unknown, // TODO: should have its own kind?
            kindModifiers: "",
            displayParts: [textPart(name)],
            documentation: emptyArray,
            tags: undefined,
            codeActions: undefined,
        };
    }

    export function getJSDocParameterNameCompletions(tag: JSDocParameterTag): CompletionEntry[] {
        if (!isIdentifier(tag.name)) {
            return emptyArray;
        }
        const nameThusFar = tag.name.text;
        const jsdoc = tag.parent;
        const fn = jsdoc.parent;
        if (!isFunctionLike(fn)) return [];

        return mapDefined(fn.parameters, param => {
            if (!isIdentifier(param.name)) return undefined;

            const name = param.name.text;
            if (jsdoc.tags!.some(t => t !== tag && isJSDocParameterTag(t) && isIdentifier(t.name) && t.name.escapedText === name) // TODO: GH#18217
                || nameThusFar !== undefined && !startsWith(name, nameThusFar)) {
                return undefined;
            }

            return { name, kind: ScriptElementKind.parameterElement, kindModifiers: "", sortText: Completions.SortText.LocationPriority };
        });
    }

    export function getJSDocParameterNameCompletionDetails(name: string): CompletionEntryDetails {
        return {
            name,
            kind: ScriptElementKind.parameterElement,
            kindModifiers: "",
            displayParts: [textPart(name)],
            documentation: emptyArray,
            tags: undefined,
            codeActions: undefined,
        };
    }

    /**
     * Checks if position points to a valid position to add JSDoc comments, and if so,
     * returns the appropriate template. Otherwise returns an empty string.
     * Valid positions are
     *      - outside of comments, statements, and expressions, and
     *      - preceding a:
     *          - function/constructor/method declaration
     *          - class declarations
     *          - variable statements
     *          - namespace declarations
     *          - interface declarations
     *          - method signatures
     *          - type alias declarations
     *
     * Hosts should ideally check that:
     * - The line is all whitespace up to 'position' before performing the insertion.
     * - If the keystroke sequence "/\*\*" induced the call, we also check that the next
     * non-whitespace character is '*', which (approximately) indicates whether we added
     * the second '*' to complete an existing (JSDoc) comment.
     * @param fileName The file in which to perform the check.
     * @param position The (character-indexed) position in the file where the check should
     * be performed.
     */
    export function getDocCommentTemplateAtPosition(newLine: string, sourceFile: SourceFile, position: number, options?: DocCommentTemplateOptions): TextInsertion | undefined {
        const tokenAtPos = getTokenAtPosition(sourceFile, position);
        const existingDocComment = findAncestor(tokenAtPos, isJSDoc);
        if (existingDocComment && (existingDocComment.comment !== undefined || length(existingDocComment.tags))) {
            // Non-empty comment already exists.
            return undefined;
        }

        const tokenStart = tokenAtPos.getStart(sourceFile);
        // Don't provide a doc comment template based on a *previous* node. (But an existing empty jsdoc comment will likely start before `position`.)
        if (!existingDocComment && tokenStart < position) {
            return undefined;
        }

        const commentOwnerInfo = getCommentOwnerInfo(tokenAtPos, options);
        if (!commentOwnerInfo) {
            return undefined;
        }

        const { commentOwner, parameters, hasReturn } = commentOwnerInfo;
        if (commentOwner.getStart(sourceFile) < position) {
            return undefined;
        }

        const indentationStr = getIndentationStringAtPosition(sourceFile, position);
        const isJavaScriptFile = hasJSFileExtension(sourceFile.fileName);
        const tags =
            (parameters ? parameterDocComments(parameters || [], isJavaScriptFile, indentationStr, newLine) : "") +
            (hasReturn ? returnsDocComment(indentationStr, newLine) : "");

        // A doc comment consists of the following
        // * The opening comment line
        // * the first line (without a param) for the object's untagged info (this is also where the caret ends up)
        // * the '@param'-tagged lines
        // * the '@returns'-tag
        // * TODO: other tags.
        // * the closing comment line
        // * if the caret was directly in front of the object, then we add an extra line and indentation.
        const openComment = "/**";
        const closeComment = " */";
        if (tags) {
            const preamble = openComment + newLine + indentationStr + " * ";
            const endLine = tokenStart === position ? newLine + indentationStr : "";
            const result = preamble + newLine + tags + indentationStr + closeComment + endLine;
            return { newText: result, caretOffset: preamble.length };
        }
        return { newText: openComment + closeComment, caretOffset: 3 };
    }

    function getIndentationStringAtPosition(sourceFile: SourceFile, position: number): string {
        const { text } = sourceFile;
        const lineStart = getLineStartPositionForPosition(position, sourceFile);
        let pos = lineStart;
        for (; pos <= position && isWhiteSpaceSingleLine(text.charCodeAt(pos)); pos++);
        return text.slice(lineStart, pos);
    }

    function parameterDocComments(parameters: readonly ParameterDeclaration[], isJavaScriptFile: boolean, indentationStr: string, newLine: string): string {
        return parameters.map(({ name, dotDotDotToken }, i) => {
            const paramName = name.kind === SyntaxKind.Identifier ? name.text : "param" + i;
            const type = isJavaScriptFile ? (dotDotDotToken ? "{...any} " : "{any} ") : "";
            return `${indentationStr} * @param ${type}${paramName}${newLine}`;
        }).join("");
    }

    function returnsDocComment(indentationStr: string, newLine: string) {
        return `${indentationStr} * @returns${newLine}`;
    }

    interface CommentOwnerInfo {
        readonly commentOwner: Node;
        readonly parameters?: readonly ParameterDeclaration[];
        readonly hasReturn?: boolean;
    }
    function getCommentOwnerInfo(tokenAtPos: Node, options: DocCommentTemplateOptions | undefined): CommentOwnerInfo | undefined {
        return forEachAncestor(tokenAtPos, n => getCommentOwnerInfoWorker(n, options));
    }
    function getCommentOwnerInfoWorker(commentOwner: Node, options: DocCommentTemplateOptions | undefined): CommentOwnerInfo | undefined | "quit" {
        switch (commentOwner.kind) {
            case SyntaxKind.FunctionDeclaration:
            case SyntaxKind.FunctionExpression:
            case SyntaxKind.MethodDeclaration:
            case SyntaxKind.Constructor:
            case SyntaxKind.MethodSignature:
            case SyntaxKind.ArrowFunction:
                const host = commentOwner as ArrowFunction | FunctionDeclaration | MethodDeclaration | ConstructorDeclaration | MethodSignature;
                return { commentOwner, parameters: host.parameters, hasReturn: hasReturn(host, options) };

            case SyntaxKind.PropertyAssignment:
                return getCommentOwnerInfoWorker((commentOwner as PropertyAssignment).initializer, options);

            case SyntaxKind.ClassDeclaration:
            case SyntaxKind.InterfaceDeclaration:
            case SyntaxKind.PropertySignature:
            case SyntaxKind.EnumDeclaration:
            case SyntaxKind.EnumMember:
            case SyntaxKind.TypeAliasDeclaration:
                return { commentOwner };

            case SyntaxKind.VariableStatement: {
                const varStatement = <VariableStatement>commentOwner;
                const varDeclarations = varStatement.declarationList.declarations;
                const host = varDeclarations.length === 1 && varDeclarations[0].initializer
                    ? getRightHandSideOfAssignment(varDeclarations[0].initializer)
                    : undefined;
                return host
                    ? { commentOwner, parameters: host.parameters, hasReturn: hasReturn(host, options) }
                    : { commentOwner };
            }

            case SyntaxKind.SourceFile:
                return "quit";

            case SyntaxKind.ModuleDeclaration:
                // If in walking up the tree, we hit a a nested namespace declaration,
                // then we must be somewhere within a dotted namespace name; however we don't
                // want to give back a JSDoc template for the 'b' or 'c' in 'namespace a.b.c { }'.
                return commentOwner.parent.kind === SyntaxKind.ModuleDeclaration ? undefined : { commentOwner };

            case SyntaxKind.ExpressionStatement:
                return getCommentOwnerInfoWorker((commentOwner as ExpressionStatement).expression, options);
            case SyntaxKind.BinaryExpression: {
                const be = commentOwner as BinaryExpression;
                if (getAssignmentDeclarationKind(be) === AssignmentDeclarationKind.None) {
                    return "quit";
                }
                return isFunctionLike(be.right)
                    ? { commentOwner, parameters: be.right.parameters, hasReturn: hasReturn(be.right, options) }
                    : { commentOwner };
            }
            case SyntaxKind.PropertyDeclaration:
                const init = (commentOwner as PropertyDeclaration).initializer;
                if (init && (isFunctionExpression(init) || isArrowFunction(init))) {
                    return { commentOwner, parameters: init.parameters, hasReturn: hasReturn(init, options) };
                }
        }
    }

    function hasReturn(node: Node, options: DocCommentTemplateOptions | undefined) {
        return !!options?.generateReturnInDocTemplate &&
            (isArrowFunction(node) && isExpression(node.body)
                || isFunctionLikeDeclaration(node) && node.body && isBlock(node.body) && !!forEachReturnStatement(node.body, n => n));
    }

    function getRightHandSideOfAssignment(rightHandSide: Expression): FunctionExpression | ArrowFunction | ConstructorDeclaration | undefined {
        while (rightHandSide.kind === SyntaxKind.ParenthesizedExpression) {
            rightHandSide = (<ParenthesizedExpression>rightHandSide).expression;
        }

        switch (rightHandSide.kind) {
            case SyntaxKind.FunctionExpression:
            case SyntaxKind.ArrowFunction:
                return (<FunctionExpression>rightHandSide);
            case SyntaxKind.ClassExpression:
                return find((rightHandSide as ClassExpression).members, isConstructorDeclaration);
        }
    }
}
