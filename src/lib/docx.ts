import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
    PageNumber, Header, Footer, HeadingLevel, PageBreak
} from 'docx';
import { Exam } from '../types';

// DXA units: 1440 = 1 inch
// A4 page: 11906 x 16838 twips
// Margins: top/bottom 1440 (1in), left 1701 (1.18in ~3cm), right 1134 (0.79in ~2cm)
const PAGE_MARGINS = { top: 1134, right: 1134, bottom: 1134, left: 1701 };
// Usable width = 11906 - 1701 - 1134 = 9071 DXA
const USABLE_WIDTH = 9071;

const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const CELL_BORDERS_NONE = { top: BORDER_NONE, bottom: BORDER_NONE, left: BORDER_NONE, right: BORDER_NONE };
const BORDER_THIN = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const CELL_BORDERS = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };

/** Strip basic markdown for clean Word text */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // bold
        .replace(/\*(.*?)\*/g, '$1')       // italic
        .replace(/`(.*?)`/g, '$1')         // inline code
        .replace(/#{1,6}\s/g, '')          // headings
        .trim();
}

/** Parse markdown bold into TextRun array */
function parseMarkdownRuns(text: string, baseFontSize = 24, baseFont = 'Times New Roman'): TextRun[] {
    const runs: TextRun[] = [];
    // Split on **bold** and *italic* patterns
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    for (const part of parts) {
        if (!part) continue;
        if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: baseFontSize, font: baseFont }));
        } else if (part.startsWith('*') && part.endsWith('*')) {
            runs.push(new TextRun({ text: part.slice(1, -1), italics: true, size: baseFontSize, font: baseFont }));
        } else {
            runs.push(new TextRun({ text: part, size: baseFontSize, font: baseFont }));
        }
    }
    return runs.length > 0 ? runs : [new TextRun({ text, size: baseFontSize, font: baseFont })];
}

function makeEmptyPara(spaceAfter = 0): Paragraph {
    return new Paragraph({ spacing: { after: spaceAfter }, children: [new TextRun('')] });
}

function makeDivider(): Paragraph {
    return new Paragraph({
        spacing: { before: 100, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
        children: []
    });
}

export async function exportExamToDocx(exam: Exam): Promise<void> {
    const { matrix, questions, title } = exam;

    // ───────────────────────────────────────────────
    // SECTION 1: EXAM PAPER (questions only, no answers)
    // ───────────────────────────────────────────────
    const examChildren: (Paragraph | Table)[] = [
        // School block
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: 'SỞ GD&ĐT ________________', size: 22, font: 'Times New Roman' })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: 'TRƯỜNG THPT ________________', bold: true, size: 22, font: 'Times New Roman' })]
        }),

        // Exam Title
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({
                text: `ĐỀ KIỂM TRA - MÔN ${matrix.subject.toUpperCase()}`,
                bold: true, size: 28, font: 'Times New Roman'
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: title, italics: true, size: 22, font: 'Times New Roman' })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({
                text: `Thời gian làm bài: ${matrix.durationMinutes} phút (Không kể thời gian phát đề)`,
                size: 22, font: 'Times New Roman'
            })]
        }),

        // Candidate info table
        new Table({
            columnWidths: [Math.floor(USABLE_WIDTH * 0.5), Math.floor(USABLE_WIDTH * 0.5)],
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: CELL_BORDERS_NONE,
                            width: { size: Math.floor(USABLE_WIDTH * 0.5), type: WidthType.DXA },
                            children: [new Paragraph({
                                children: [new TextRun({ text: 'Họ và tên: ................................................', size: 22, font: 'Times New Roman' })]
                            })]
                        }),
                        new TableCell({
                            borders: CELL_BORDERS_NONE,
                            width: { size: Math.floor(USABLE_WIDTH * 0.5), type: WidthType.DXA },
                            children: [new Paragraph({
                                children: [new TextRun({ text: 'Số báo danh: ................................', size: 22, font: 'Times New Roman' })]
                            })]
                        }),
                    ]
                })
            ]
        }),

        makeEmptyPara(160),
        makeDivider(),
        makeEmptyPara(80),
    ];

    // Questions
    for (const q of questions) {
        // Question stem
        const qRuns: TextRun[] = [
            new TextRun({ text: `Câu ${q.originalId}: `, bold: true, size: 24, font: 'Times New Roman' }),
            ...parseMarkdownRuns(stripMarkdown(q.content), 24),
        ];
        examChildren.push(
            new Paragraph({
                spacing: { before: 120, after: 80 },
                children: qRuns,
            })
        );

        // Options in 2-column table for MC
        if (q.type === 'multiple_choice' && q.options && q.options.length === 4) {
            const colW = Math.floor(USABLE_WIDTH / 4);
            const makeOptCell = (opt: { id: string; content: string }) =>
                new TableCell({
                    borders: CELL_BORDERS_NONE,
                    width: { size: colW, type: WidthType.DXA },
                    children: [new Paragraph({
                        spacing: { after: 40 },
                        children: [
                            new TextRun({ text: `${opt.id}. `, bold: true, size: 24, font: 'Times New Roman' }),
                            ...parseMarkdownRuns(stripMarkdown(opt.content), 24),
                        ]
                    })]
                });

            examChildren.push(
                new Table({
                    columnWidths: [colW, colW, colW, colW],
                    margins: { top: 0, bottom: 0, left: 360, right: 0 },
                    rows: [
                        new TableRow({
                            children: q.options.map(opt => makeOptCell(opt))
                        })
                    ]
                })
            );
        }

        examChildren.push(makeEmptyPara(40));
    }

    // ───────────────────────────────────────────────
    // SECTION 2: ANSWER KEY (new page)
    // ───────────────────────────────────────────────
    const answerChildren: (Paragraph | Table)[] = [
        new Paragraph({
            pageBreakBefore: true,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: 'ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM', bold: true, size: 28, font: 'Times New Roman' })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [new TextRun({ text: `Môn ${matrix.subject} — ${matrix.durationMinutes} phút`, italics: true, size: 22, font: 'Times New Roman' })]
        }),
    ];

    // Quick answer table
    const answersPerRow = 5;
    const answerRows: TableRow[] = [];
    // Header row
    const colW2 = Math.floor(USABLE_WIDTH / (answersPerRow * 2));
    const headerCells: TableCell[] = [];
    for (let i = 0; i < answersPerRow; i++) {
        headerCells.push(
            new TableCell({
                borders: CELL_BORDERS,
                width: { size: colW2, type: WidthType.DXA },
                shading: { fill: 'DBEAFE', type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Câu', bold: true, size: 20, font: 'Times New Roman' })] })]
            }),
            new TableCell({
                borders: CELL_BORDERS,
                width: { size: colW2, type: WidthType.DXA },
                shading: { fill: 'DBEAFE', type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Đáp án', bold: true, size: 20, font: 'Times New Roman' })] })]
            }),
        );
    }
    answerRows.push(new TableRow({ tableHeader: true, children: headerCells }));

    // Data rows
    const chunks: typeof questions[] = [];
    for (let i = 0; i < questions.length; i += answersPerRow) {
        chunks.push(questions.slice(i, i + answersPerRow));
    }
    for (const chunk of chunks) {
        const cells: TableCell[] = [];
        for (let i = 0; i < answersPerRow; i++) {
            const q = chunk[i];
            cells.push(
                new TableCell({
                    borders: CELL_BORDERS,
                    width: { size: colW2, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q ? `${q.originalId}` : '', size: 22, font: 'Times New Roman' })] })]
                }),
                new TableCell({
                    borders: CELL_BORDERS,
                    width: { size: colW2, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q?.correctAnswer || '', bold: true, size: 22, font: 'Times New Roman', color: '1D4ED8' })] })]
                }),
            );
        }
        // Pad remaining cells
        for (let i = chunk.length; i < answersPerRow; i++) {
            cells.push(
                new TableCell({ borders: CELL_BORDERS, width: { size: colW2, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('')] })] }),
                new TableCell({ borders: CELL_BORDERS, width: { size: colW2, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('')] })] }),
            );
        }
        answerRows.push(new TableRow({ children: cells }));
    }

    const totalColW = colW2 * 2;
    answerChildren.push(
        new Table({
            columnWidths: Array(answersPerRow * 2).fill(colW2),
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            rows: answerRows,
        })
    );

    answerChildren.push(makeEmptyPara(240));
    answerChildren.push(new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: 'GIẢI THÍCH CHI TIẾT', bold: true, size: 26, font: 'Times New Roman' })]
    }));

    // Detailed explanations
    for (const q of questions) {
        answerChildren.push(
            new Paragraph({
                spacing: { before: 160, after: 60 },
                children: [
                    new TextRun({ text: `Câu ${q.originalId}`, bold: true, size: 24, font: 'Times New Roman' }),
                    new TextRun({ text: ` — Đáp án đúng: `, size: 24, font: 'Times New Roman' }),
                    new TextRun({ text: q.correctAnswer || '', bold: true, size: 24, font: 'Times New Roman', color: '15803D' }),
                    new TextRun({ text: ` (${q.topic} — ${q.difficulty})`, italics: true, size: 22, font: 'Times New Roman', color: '64748B' }),
                ]
            })
        );

        // Split explanation by newlines into separate paragraphs
        const explanationLines = stripMarkdown(q.explanation).split('\n').filter(l => l.trim());
        for (const line of explanationLines) {
            answerChildren.push(
                new Paragraph({
                    spacing: { after: 40 },
                    indent: { left: 360 },
                    children: [new TextRun({ text: line, size: 22, font: 'Times New Roman' })]
                })
            );
        }
        answerChildren.push(makeDivider());
    }

    // ───────────────────────────────────────────────
    // Assemble Document
    // ───────────────────────────────────────────────
    const doc = new Document({
        styles: {
            default: {
                document: { run: { font: 'Times New Roman', size: 24 } }
            }
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: PAGE_MARGINS,
                        size: { width: 11906, height: 16838 } // A4
                    }
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({ text: `${matrix.subject} — `, size: 18, font: 'Times New Roman', color: '94A3B8' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Times New Roman', color: '94A3B8' }),
                            ]
                        })]
                    })
                },
                children: [...examChildren, ...answerChildren],
            }
        ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_EzExam.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
