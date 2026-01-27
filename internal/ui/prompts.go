package ui

import (
	"errors"
	"strings"

	"github.com/manifoldco/promptui"
)

// Confirm prompts the user for a yes/no confirmation
func Confirm(message string) (bool, error) {
	prompt := promptui.Prompt{
		Label:     message,
		IsConfirm: true,
	}

	result, err := prompt.Run()
	if err != nil {
		if errors.Is(err, promptui.ErrAbort) {
			return false, nil
		}
		return false, err
	}

	return strings.ToLower(result) == "y" || result == "", nil
}

// Select prompts the user to select from a list of options
func Select(message string, options []string) (string, error) {
	prompt := promptui.Select{
		Label: message,
		Items: options,
	}

	_, result, err := prompt.Run()
	if err != nil {
		return "", err
	}

	return result, nil
}

// SelectIndex prompts the user to select and returns the index
func SelectIndex(message string, options []string) (int, error) {
	prompt := promptui.Select{
		Label: message,
		Items: options,
	}

	index, _, err := prompt.Run()
	if err != nil {
		return -1, err
	}

	return index, nil
}

// Input prompts the user for text input with an optional default value
func Input(message string, defaultVal string) (string, error) {
	prompt := promptui.Prompt{
		Label:   message,
		Default: defaultVal,
	}

	result, err := prompt.Run()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(result), nil
}

// InputRequired prompts the user for required text input
func InputRequired(message string) (string, error) {
	prompt := promptui.Prompt{
		Label: message,
		Validate: func(input string) error {
			if strings.TrimSpace(input) == "" {
				return errors.New("this field is required")
			}
			return nil
		},
	}

	result, err := prompt.Run()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(result), nil
}

// InputWithValidation prompts for input with custom validation
func InputWithValidation(message string, defaultVal string, validate func(string) error) (string, error) {
	prompt := promptui.Prompt{
		Label:    message,
		Default:  defaultVal,
		Validate: validate,
	}

	result, err := prompt.Run()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(result), nil
}

// Password prompts for password input (hidden)
func Password(message string) (string, error) {
	prompt := promptui.Prompt{
		Label: message,
		Mask:  '*',
	}

	result, err := prompt.Run()
	if err != nil {
		return "", err
	}

	return result, nil
}
