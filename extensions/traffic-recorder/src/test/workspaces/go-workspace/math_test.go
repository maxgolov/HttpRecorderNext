package example

import "testing"

func TestAddition(t *testing.T) {
    result := 1 + 2
    if result != 3 {
        t.Errorf("Expected 3, got %d", result)
    }
}
