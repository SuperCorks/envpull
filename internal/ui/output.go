package ui

import (
	"fmt"
	"os"

	"github.com/fatih/color"
)

var (
	greenCheck  = color.New(color.FgGreen).Sprint("✓")
	redCross    = color.New(color.FgRed).Sprint("✗")
	blueInfo    = color.New(color.FgBlue).Sprint("ℹ")
	yellowWarn  = color.New(color.FgYellow).Sprint("⚠")
	greenBold   = color.New(color.FgGreen, color.Bold)
	redBold     = color.New(color.FgRed, color.Bold)
	blueBold    = color.New(color.FgBlue, color.Bold)
	yellowBold  = color.New(color.FgYellow, color.Bold)
	cyanColor   = color.New(color.FgCyan)
	dimColor    = color.New(color.Faint)
)

// Success prints a success message with a green checkmark
func Success(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Printf("%s %s\n", greenCheck, msg)
}

// Error prints an error message with a red cross
func Error(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Fprintf(os.Stderr, "%s %s\n", redCross, msg)
}

// Info prints an info message with a blue info icon
func Info(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Printf("%s %s\n", blueInfo, msg)
}

// Warning prints a warning message with a yellow warning icon
func Warning(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Printf("%s %s\n", yellowWarn, msg)
}

// Print prints a plain message
func Print(format string, args ...interface{}) {
	fmt.Printf(format, args...)
}

// Println prints a plain message with newline
func Println(format string, args ...interface{}) {
	fmt.Printf(format+"\n", args...)
}

// Bold prints a bold message
func Bold(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	color.New(color.Bold).Println(msg)
}

// Cyan prints a cyan colored message
func Cyan(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	cyanColor.Println(msg)
}

// Dim prints a dimmed message
func Dim(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	dimColor.Println(msg)
}

// Green prints green text
func Green(format string, args ...interface{}) {
	greenBold.Printf(format, args...)
}

// Red prints red text
func Red(format string, args ...interface{}) {
	redBold.Printf(format, args...)
}

// Yellow prints yellow text
func Yellow(format string, args ...interface{}) {
	yellowBold.Printf(format, args...)
}

// Blue prints blue text
func Blue(format string, args ...interface{}) {
	blueBold.Printf(format, args...)
}

// Table prints a simple table
func Table(headers []string, rows [][]string) {
	// Calculate column widths
	widths := make([]int, len(headers))
	for i, h := range headers {
		widths[i] = len(h)
	}
	for _, row := range rows {
		for i, cell := range row {
			if i < len(widths) && len(cell) > widths[i] {
				widths[i] = len(cell)
			}
		}
	}

	// Print headers
	for i, h := range headers {
		fmt.Printf("%-*s  ", widths[i], h)
	}
	fmt.Println()

	// Print separator
	for i := range headers {
		for j := 0; j < widths[i]; j++ {
			fmt.Print("-")
		}
		fmt.Print("  ")
	}
	fmt.Println()

	// Print rows
	for _, row := range rows {
		for i, cell := range row {
			if i < len(widths) {
				fmt.Printf("%-*s  ", widths[i], cell)
			}
		}
		fmt.Println()
	}
}
