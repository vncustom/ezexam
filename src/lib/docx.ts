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
function stripMarkdown(text: string | undefined | null): string {
    if (!text) return '';
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

    // Helper to write a question block
    const writeQuestionToChildren = (q: any, childrenArray: any[]) => {
        const qRuns: TextRun[] = [
            new TextRun({ text: `Câu ${q.originalId}: `, bold: true, size: 24, font: 'Times New Roman' }),
            ...parseMarkdownRuns(stripMarkdown(q.content), 24),
        ];
        childrenArray.push(
            new Paragraph({
                spacing: { before: 120, after: 80 },
                children: qRuns,
            })
        );

        if (q.type === 'multiple_choice' && q.options && q.options.length > 0) {
            for (const opt of q.options) {
                childrenArray.push(
                    new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `${opt.id}. `, bold: true, size: 24, font: 'Times New Roman' }),
                            ...parseMarkdownRuns(stripMarkdown(opt.content), 24),
                        ]
                    })
                );
            }
        } else if (q.type === 'true_false' && q.options && q.options.length > 0) {
            for (const opt of q.options) {
                childrenArray.push(
                    new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `${opt.id.toLowerCase()}) `, bold: true, size: 24, font: 'Times New Roman' }),
                            ...parseMarkdownRuns(stripMarkdown(opt.content), 24),
                            new TextRun({ text: '  .................................................  [ Đúng / Sai ]', italics: true, size: 22, font: 'Times New Roman', color: '888888' })
                        ]
                    })
                );
            }
        } else if (q.type === 'short_answer') {
            childrenArray.push(
                new Paragraph({
                    spacing: { before: 60, after: 60 },
                    indent: { left: 360 },
                    children: [
                        new TextRun({ text: 'Đáp số: ........................................................................', italics: true, size: 24, font: 'Times New Roman', color: '666666' })
                    ]
                })
            );
        } else if (q.type === 'essay') {
            childrenArray.push(
                new Paragraph({
                    spacing: { before: 60, after: 80 },
                    indent: { left: 360 },
                    children: [
                        new TextRun({ text: 'Bài làm:\n................................................................................................................................................\n................................................................................................................................................', italics: true, size: 24, font: 'Times New Roman', color: '888888' })
                    ]
                })
            );
        }

        childrenArray.push(makeEmptyPara(40));
    };

    // Render questions by section if available
    const sections = matrix.sections;
    if (sections && sections.length > 0) {
        for (const sec of sections) {
            const secQuestions = questions.filter(q => q.sectionId === sec.id);
            if (secQuestions.length === 0) continue;

            examChildren.push(
                new Paragraph({
                    spacing: { before: 180, after: 80 },
                    children: [
                        new TextRun({ text: sec.name.toUpperCase(), bold: true, size: 24, font: 'Times New Roman' })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 120 },
                    children: [
                        new TextRun({ text: sec.instruction, italics: true, size: 22, font: 'Times New Roman' })
                    ]
                })
            );

            if (sec.passage) {
                examChildren.push(
                    new Paragraph({
                        spacing: { before: 80, after: 80 },
                        indent: { left: 240, right: 240 },
                        border: {
                            left: { style: BorderStyle.SINGLE, size: 12, color: '888888' }
                        },
                        children: [
                            new TextRun({ text: 'Đọc hiểu ngữ liệu sau đây:\n', bold: true, size: 22, font: 'Times New Roman' }),
                            new TextRun({ text: sec.passage, size: 22, font: 'Times New Roman', italics: true })
                        ]
                    }),
                    makeEmptyPara(40)
                );
            }

            for (const q of secQuestions) {
                writeQuestionToChildren(q, examChildren);
            }
        }
    } else {
        // Fallback: flat list
        for (const q of questions) {
            writeQuestionToChildren(q, examChildren);
        }
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
            
            let displayAnswer = q?.correctAnswer || '';
            if (q?.type === 'true_false' && displayAnswer) {
                // Shorten "Đúng" to "Đ" and "Sai" to "S" for table compactness
                displayAnswer = displayAnswer.replace(/Đúng/g, 'Đ').replace(/Sai/g, 'S');
            }

            cells.push(
                new TableCell({
                    borders: CELL_BORDERS,
                    width: { size: colW2, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q ? `${q.originalId}` : '', size: 22, font: 'Times New Roman' })] })]
                }),
                new TableCell({
                    borders: CELL_BORDERS,
                    width: { size: colW2, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: displayAnswer, bold: true, size: 22, font: 'Times New Roman', color: '1D4ED8' })] })]
                }),
            );
        }
        for (let i = chunk.length; i < answersPerRow; i++) {
            cells.push(
                new TableCell({ borders: CELL_BORDERS, width: { size: colW2, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('')] })] }),
                new TableCell({ borders: CELL_BORDERS, width: { size: colW2, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun('')] })] }),
            );
        }
        answerRows.push(new TableRow({ children: cells }));
    }

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
