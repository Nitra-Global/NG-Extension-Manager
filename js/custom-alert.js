// Custom Alert System
(function() {
    // Function to create and show an alert
    function createAlert(type, message) {
        // Remove any existing alerts
        removeAlerts();

        // Create alert container
        const alertContainer = document.createElement('div');
        alertContainer.classList.add('custom-alert', type);
        alertContainer.innerHTML = `
            <div class="custom-alert-content">
                <span class="custom-alert-close">&times;</span>
                <p>${message}</p>
            </div>
        `;

        // Append alert to body
        document.body.appendChild(alertContainer);

        // Add event listener to close button
        const closeButton = alertContainer.querySelector('.custom-alert-close');
        closeButton.addEventListener('click', () => {
            removeAlerts();
        });

        // Automatically remove alert after 5 seconds
        setTimeout(() => {
            removeAlerts();
        }, 5000);
    }

    // Function to remove all alerts
    function removeAlerts() {
        const alerts = document.querySelectorAll('.custom-alert');
        alerts.forEach(alert => alert.remove());
    }

    // Functions for different types of alerts
    window.customAlert = {
        showError: function(message) {
            createAlert('error', message);
        },
        showWarning: function(message) {
            createAlert('warning', message);
        },
        showInfo: function(message) {
            createAlert('info', message);
        },
        showSuccess: function(message) {
            createAlert('success', message);
        },
        showConfirmation: function(message, onConfirm, onCancel) {
            // Remove existing alerts
            removeAlerts();

            // Create confirmation container
            const confirmationContainer = document.createElement('div');
            confirmationContainer.classList.add('custom-confirmation');
            confirmationContainer.innerHTML = `
                <div class="custom-confirmation-content">
                    <p>${message}</p>
                    <button class="custom-confirmation-yes">Yes</button>
                    <button class="custom-confirmation-no">No</button>
                </div>
            `;

            // Append confirmation to body
            document.body.appendChild(confirmationContainer);

            // Add event listeners to buttons
            const yesButton = confirmationContainer.querySelector('.custom-confirmation-yes');
            const noButton = confirmationContainer.querySelector('.custom-confirmation-no');

            yesButton.addEventListener('click', () => {
                if (onConfirm) onConfirm();
                confirmationContainer.remove();
            });

            noButton.addEventListener('click', () => {
                if (onCancel) onCancel();
                confirmationContainer.remove();
            });
        }
    };

    // Styles for alerts
    const style = document.createElement('style');
    style.textContent = `
        .custom-alert, .custom-confirmation {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            opacity: 0;
            transform: translateY(-20px);
            transition: opacity 0.3s, transform 0.3s;
        }
        .custom-alert.show, .custom-confirmation.show {
            opacity: 1;
            transform: translateY(0);
        }
        .custom-alert-error {
            background-color: #f8d7da;
            color: #721c24;
        }
        .custom-alert-warning {
            background-color: #fff3cd;
            color: #856404;
        }
        .custom-alert-info {
            background-color: #d1ecf1;
            color: #0c5460;
        }
        .custom-alert-success {
            background-color: #d4edda;
            color: #155724;
        }
        .custom-alert-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .custom-alert-close {
            font-size: 20px;
            cursor: pointer;
            margin-left: 10px;
        }
        .custom-confirmation {
            background-color: #ffffff;
            border: 1px solid #ddd;
        }
        .custom-confirmation-content {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .custom-confirmation button {
            margin: 5px;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background-color: #1e90ff;
            color: #fff;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .custom-confirmation button:hover {
            background-color: #005cbf;
        }
        .custom-confirmation .custom-confirmation-no {
            background-color: #f44336;
        }
        .custom-confirmation .custom-confirmation-no:hover {
            background-color: #c62828;
        }
    `;
    document.head.appendChild(style);
})();
